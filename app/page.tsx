'use client';

import { useState, useEffect, useRef, useMemo, useDeferredValue, memo, useCallback } from 'react';
import imageCompression from 'browser-image-compression';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Upload,
  Trash2,
  Tag as TagIcon,
  Layers,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Eye,
  Calendar,
  Clock,
  Sparkles,
  Filter,
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sun,
  Moon,
  LogOut,
  Key,
  Globe,
  Menu,
  LayoutGrid,
  List,
  ArrowUp
} from 'lucide-react';

import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/LanguageContext';
import type { Language } from '@/lib/i18n';
import { db, auth, storage } from '@/lib/firebase';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import Login from '@/components/Login';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

interface Screenshot {
  id: string;
  url: string;
  imageUrl?: string;
  text?: string;
  tags: string[];
  category?: string;
  summary?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  createdAt: string;
  updatedAt: string;
}

interface QueueItem {
  id: string;
  name: string;
  size: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progressText: string;
}

const LibraryCard = memo(function LibraryCard({ s, onClick, isSelected, onToggleSelect, viewMode }: { s: Screenshot; onClick: (s: Screenshot) => void; isSelected: boolean; onToggleSelect: (id: string, e: React.MouseEvent) => void; viewMode: 'grid' | 'list' }) {
  const [loaded, setLoaded] = useState(false);
  
  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        onClick={() => onClick(s)}
        className={`group relative flex items-center w-full p-2.5 bg-white dark:bg-slate-900 rounded-xl border transition-all cursor-pointer select-none ${isSelected ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500'}`}
      >
        <div 
          onClick={(e) => onToggleSelect(s.id, e)}
          className="absolute -left-3 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-30 hidden md:block" // Desktop hover visual aid
        />
        <button
          onClick={(e) => onToggleSelect(s.id, e)}
          className={`shrink-0 w-5 h-5 rounded border mr-3 flex items-center justify-center transition-colors z-30 ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}
        >
          {isSelected && <Check className="w-3.5 h-3.5" />}
        </button>

        <div className="relative w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden shrink-0">
          {!loaded && <div className="absolute inset-0 animate-pulse bg-slate-200 dark:bg-slate-800 z-0" />}
          <img
            src={s.imageUrl || s.url}
            alt={s.summary || 'Screenshot'}
            onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            referrerPolicy="no-referrer"
            loading="lazy"
          />
        </div>

        <div className="flex-1 min-w-0 px-3 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {s.status === 'pending' && (
              <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded-md">
                <Clock className="w-2.5 h-2.5" /><span>Pending</span>
              </span>
            )}
            {s.status === 'error' && (
              <span className="flex items-center space-x-1 px-1.5 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] font-bold rounded-md">
                <AlertCircle className="w-2.5 h-2.5" /><span>Error</span>
              </span>
            )}
            {s.category && (
              <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-md uppercase tracking-wider truncate max-w-full">
                {s.category}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate w-full pr-2">
            {s.summary || s.text || 'Memindai gambar untuk rincian...'}
          </p>
        </div>
        
        <div className="shrink-0 p-2 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye className="w-4 h-4" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(s)}
      className={`group relative aspect-square w-full bg-slate-900 rounded-xl border ${isSelected ? 'border-indigo-500 shadow-md scale-[1.015]' : 'border-slate-205 hover:border-indigo-500 hover:shadow-md hover:scale-[1.015]'} transition-all cursor-pointer overflow-hidden flex items-center justify-center select-none`}
    >
      <button
        onClick={(e) => onToggleSelect(s.id, e)}
        className={`absolute top-2 right-2 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors z-30 ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-black/20 border-white/50 backdrop-blur-md opacity-0 group-hover:opacity-100 hover:bg-black/40'}`}
      >
        {isSelected && <Check className="w-3.5 h-3.5 shadow-sm" />}
      </button>

      {!loaded && <div className="absolute inset-0 animate-pulse bg-slate-800 z-0" />}
      <img
        src={s.imageUrl || s.url}
        alt={s.summary || 'Screenshot'}
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ease-in-out relative z-10 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        referrerPolicy="no-referrer"
        loading="lazy"
      />

      {/* Status Badges Overlay */}
      <div className="absolute top-2 left-2 right-8 flex flex-wrap items-center gap-1 z-20 pointer-events-none">
        {s.status === 'pending' && (
          <span className="flex items-center space-x-1 px-2 py-0.5 bg-amber-500/90 text-white text-[9px] font-bold rounded-md backdrop-blur-sm shadow-sm animate-pulse">
            <Clock className="w-2.5 h-2.5" />
            <span>Pending</span>
          </span>
        )}
        {s.status === 'processing' && (
          <span className="flex items-center space-x-1 px-2 py-0.5 bg-indigo-500/90 text-white text-[9px] font-bold rounded-md backdrop-blur-sm shadow-sm">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            <span>Processing</span>
          </span>
        )}
        {s.status === 'error' && (
          <span className="flex items-center space-x-1 px-2 py-0.5 bg-rose-500/90 text-white text-[9px] font-bold rounded-md backdrop-blur-sm shadow-sm">
            <AlertCircle className="w-2.5 h-2.5" />
            <span>Error</span>
          </span>
        )}
        {s.category && s.status !== 'pending' && s.status !== 'error' && (
          <span className="px-2 py-0.5 bg-slate-950/80 text-white text-[9px] font-black rounded-md backdrop-blur-sm tracking-wide uppercase shadow-sm truncate">
            {s.category}
          </span>
        )}
      </div>

      {/* Image View Hover Overlay */}
      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
        <div className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white shadow-xl scale-95 group-hover:scale-100 transition-transform">
          <Eye className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
});

function QuotaAlertBanner({ screenshots, selectedModel, setSelectedModel, setScreenshots }: any) {
  const hasQuotaErrors = screenshots.some((s: any) => s.status === 'error' && (
    s.text?.toLowerCase()?.includes('quota') || 
    s.text?.toLowerCase()?.includes('exhausted') || 
    s.text?.toLowerCase()?.includes('api_quota') || 
    s.text?.toLowerCase()?.includes('429')
  ));
  
  if (!hasQuotaErrors) return null;
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: -15 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl p-5 shadow-sm space-y-3.5"
      id="quota-warning-banner"
    >
      <div className="flex items-start space-x-3.5">
        <div className="p-2.5 bg-amber-500 dark:bg-amber-600 text-white rounded-xl shadow-md shrink-0">
          <AlertCircle className="w-5 h-5 animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-black text-slate-900 dark:text-amber-200 tracking-tight">Gemini API Free-Tier Quota Limit Reached</h3>
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed max-w-3xl">
            You have exceeded the standard free-tier daily usage limits for <strong>{selectedModel}</strong>. This usually allows up to 20 requests per day. You can resolve this issue instantly or switch to a lighter model!
          </p>
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-2.5 pt-3 pl-0 md:pl-12 border-t border-amber-200/50 dark:border-amber-900/20">
        <button
          onClick={() => {
            setSelectedModel('gemini-3.1-flash-lite');
            alert('Switched active AI engine to Gemini 3.1 Flash Lite model! You can now resume syncing or analyzing elements.');
          }}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer active:scale-95 border border-transparent"
        >
          Switch to Gemini 3.1 Flash Lite (High-Limit Model)
        </button>
        
        <button
          onClick={() => {
            alert('To upgrade your key to support premium models & unlimited quotas:\n\n1. Go to settings > Secrets in the top panel.\n2. Input process.env.GEMINI_API_KEY with your custom premium Billing Key.');
          }}
          className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm"
        >
          Unlock Unlimited Pro Model Quotas
        </button>
        
        <button
          onClick={async () => {
            if (confirm('Unlock and clear previous errors to re-try analyzing screenshots?')) {
              setScreenshots((prev: any) =>
                prev.map((s: any) => s.status === 'error' ? { ...s, status: 'pending', text: '', summary: '' } : s)
              );
            }
          }}
          className="px-3.5 py-2 bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-205 dark:hover:bg-amber-900/30 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
        >
          Reset Error Screenshots to Retry
        </button>
      </div>
    </motion.div>
  );
}

function ApiKeyModal({ show, onClose, apiKeys, setApiKeys, customPrompt, setCustomPrompt, t }: any) {
  if (!show) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center space-x-2">
            <Key className="w-5 h-5 text-indigo-500" />
            <span>{t('settings.title')}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t('settings.description')}<code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-amber-600 dark:text-amber-400">localStorage</code>{t('settings.description_suffix')}
            </p>
            
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-xl">
              <p className="text-xs text-indigo-800 dark:text-indigo-300 flex items-start space-x-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  {t('settings.get_key')}{' '}
                  <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noreferrer"
                    className="font-bold underline cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    {t('settings.click_here')}
                  </a>.
                </span>
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {t('settings.your_keys')}
              </label>
              {apiKeys.map((key: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="password"
                    value={key}
                    onChange={(e) => {
                      const newKeys = [...apiKeys];
                      newKeys[index] = e.target.value;
                      setApiKeys(newKeys);
                    }}
                    placeholder={t('settings.placeholder')}
                    className="flex-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-base md:text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-mono"
                  />
                  {apiKeys.length > 1 && (
                    <button
                      onClick={() => setApiKeys(apiKeys.filter((_: string, i: number) => i !== index))}
                      className="p-3 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-xl transition-colors cursor-pointer"
                      title={t('settings.remove_key')}
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setApiKeys([...apiKeys, ''])}
                className="w-full flex items-center justify-center space-x-1 py-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl transition-colors cursor-pointer border border-dashed border-indigo-200 dark:border-indigo-800"
              >
                <span>{t('settings.add_key')}</span>
              </button>
            </div>
          </div>
          
          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Prompt AI Kustom (Opsional)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ganti intruksi bawaan untuk ekstraksi teks. AI akan tetap diminta menghasilkan format JSON sesuai standar aplikasi.
            </p>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Contoh: Ekstrak tabel dan informasi penting..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all font-mono min-h-[100px] resize-y"
            />
          </div>

          <button
            onClick={() => {
              const cleanKeys = apiKeys.map((k: string) => k.trim()).filter((k: string) => k.length > 0);
              if (cleanKeys.length > 0) {
                localStorage.setItem('lenskeep_gemini_keys', JSON.stringify(cleanKeys));
                // Support legacy
                localStorage.setItem('lenskeep_gemini_key', cleanKeys[0]);
              } else {
                localStorage.removeItem('lenskeep_gemini_keys');
                localStorage.setItem('lenskeep_gemini_key', '');
              }
              setApiKeys(cleanKeys.length > 0 ? cleanKeys : ['']);
              
              onClose();
              // Custom Toast
              const toastContent = document.createElement('div');
              toastContent.className = 'fixed bottom-4 right-4 bg-emerald-50 text-emerald-600 border border-emerald-200 px-4 py-3 rounded-lg shadow-lg z-50 animate-in slide-in-from-bottom-5 text-sm font-semibold';
              toastContent.innerText = t('settings.saved_toast');
              document.body.appendChild(toastContent);
              setTimeout(() => toastContent.remove(), 3000);
            }}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all active:scale-95 shadow-md flex justify-center items-center space-x-2 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{t('settings.save')}</span>
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const { user, userProfile, loading: authLoading, logout } = useAuth();
  const { language, changeLanguage, t } = useLanguage();
  const router = useRouter();
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Safe localStorage helper to avoid sandboxed iframe errors
  const getStoredTheme = () => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem('theme');
      }
    } catch (e) {
      console.warn("Storage access restricted:", e);
    }
    return null;
  };

  const setStoredTheme = (value: string) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', value);
      }
    } catch (e) {
      console.warn("Storage access restricted:", e);
    }
  };

  // Synchronize and manage dark mode state and classes
  useEffect(() => {
    const stored = getStoredTheme();
    const isDark = stored === 'dark' || 
                 (!stored && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      setStoredTheme('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setStoredTheme('light');
    }
  };

  // Safe localStorage helpers for filter/search preferences
  const getStoredPreference = (key: string, defaultValue: string) => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(key) ?? defaultValue;
      }
    } catch (e) {
      console.warn(`Storage access restricted for ${key}:`, e);
    }
    return defaultValue;
  };

  const setStoredPreference = (key: string, value: string) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn(`Storage access restricted for ${key}:`, e);
    }
  };

  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadQueue, setUploadQueue] = useState<QueueItem[]>([]);
  const [queueSummary, setQueueSummary] = useState<{ total: number; completed: number; errors: number }>({ total: 0, completed: 0, errors: 0 });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [isUploadCollapsed, setIsUploadCollapsed] = useState<boolean>(true);
  const [hasSetInitialCollapse, setHasSetInitialCollapse] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showConfirmClearAll, setShowConfirmClearAll] = useState<boolean>(false);
  const [isClearingAll, setIsClearingAll] = useState<boolean>(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [apiKeys, setApiKeys] = useState<string[]>(['']);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  const preferencesLoaded = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowApiKeyModal(false);
        setSelectedScreenshot(null);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Load search and filter preferences on mount to persist user focus
  useEffect(() => {
    const storedQuery = getStoredPreference('lenskeep_search_query', '');
    const storedCategory = getStoredPreference('lenskeep_selected_category', 'all');
    const storedTag = getStoredPreference('lenskeep_selected_tag', 'all');
    const storedShowFilters = getStoredPreference('lenskeep_show_filters', 'false') === 'true';
    const storedCustomPrompt = getStoredPreference('lenskeep_custom_prompt', '');
    const storedViewMode = getStoredPreference('lenskeep_view_mode', 'grid') as 'grid' | 'list';

    let loadedKeys: string[] = [];
    try {
      const keysStr = localStorage.getItem('lenskeep_gemini_keys');
      if (keysStr) {
        const arr = JSON.parse(keysStr);
        if (Array.isArray(arr) && arr.length > 0) loadedKeys = arr;
      }
    } catch {}
    if (loadedKeys.length === 0) {
      const storedApiKey = getStoredPreference('lenskeep_gemini_key', '');
      if (storedApiKey) loadedKeys = [storedApiKey];
    }
    if (loadedKeys.length > 0) setApiKeys(loadedKeys);
    else setApiKeys(['']);

    if (storedQuery) setSearchQuery(storedQuery);
    if (storedCategory) setSelectedCategory(storedCategory);
    if (storedTag) setSelectedTag(storedTag);
    if (storedShowFilters) setShowFilters(storedShowFilters);
    if (storedCustomPrompt) setCustomPrompt(storedCustomPrompt);
    setViewMode(storedViewMode === 'list' ? 'list' : 'grid');

    preferencesLoaded.current = true;
  }, []);

  // Persist search, category, tag, and filter toggle choices to localStorage on modifications
  useEffect(() => {
    if (!preferencesLoaded.current) return;
    setStoredPreference('lenskeep_search_query', searchQuery);
    setStoredPreference('lenskeep_selected_category', selectedCategory);
    setStoredPreference('lenskeep_selected_tag', selectedTag);
    setStoredPreference('lenskeep_show_filters', showFilters ? 'true' : 'false');
    setStoredPreference('lenskeep_custom_prompt', customPrompt);
    setStoredPreference('lenskeep_view_mode', viewMode);
  }, [searchQuery, selectedCategory, selectedTag, showFilters, customPrompt, viewMode]);
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > window.innerHeight);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initially
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [syncStatus, setSyncStatus] = useState<{
    isSyncing: boolean;
    total: number;
    completed: number;
    failed: number;
    currentItem: string;
  }>({
    isSyncing: false,
    total: 0,
    completed: 0,
    failed: 0,
    currentItem: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Auto-expand upload zone when uploading is active
  useEffect(() => {
    if (uploading) {
      setIsUploadCollapsed(false);
    }
  }, [uploading]);

  // Set initial collapse state once screenshots are first fetched
  useEffect(() => {
    if (!loading && !hasSetInitialCollapse) {
      if (screenshots.length > 0) {
        setIsUploadCollapsed(true);
      } else {
        setIsUploadCollapsed(false);
      }
      setHasSetInitialCollapse(true);
    }
  }, [loading, screenshots, hasSetInitialCollapse]);

  // Auto-expand filters if a category or tag is active which isn't "all"
  useEffect(() => {
    if (selectedCategory !== 'all' || selectedTag !== 'all') {
      setShowFilters(true);
    }
  }, [selectedCategory, selectedTag]);

  // Real-time listener for current user's screenshots in Firestore
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setScreenshots([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'users', user.uid, 'screenshots'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Screenshot[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString();
          const updatedAt = data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString();
          
          list.push({
            id: docSnap.id,
            url: data.url,
            imageUrl: data.imageUrl || data.url,
            text: data.text || '',
            tags: data.tags || [],
            category: data.category || 'Other',
            summary: data.summary || '',
            status: data.status || 'pending',
            createdAt,
            updatedAt,
          } as Screenshot);
        });
        setScreenshots(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}/screenshots`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, authLoading]);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const filteredScreenshots = useMemo(() => {
    return screenshots.filter(s => {
      if (deferredSearchQuery) {
        const q = deferredSearchQuery.toLowerCase();
        const matchesText = s.text?.toLowerCase().includes(q);
        const matchesCategory = s.category?.toLowerCase().includes(q);
        const matchesSummary = s.summary?.toLowerCase().includes(q);
        const matchesTags = s.tags.some(t => t.toLowerCase().includes(q));
        if (!matchesText && !matchesCategory && !matchesSummary && !matchesTags) return false;
      }
      if (selectedCategory !== 'all') {
        if (s.category?.toLowerCase() !== selectedCategory.toLowerCase()) return false;
      }
      if (selectedTag !== 'all') {
        if (!s.tags.some(t => t.toLowerCase() === selectedTag.toLowerCase())) return false;
      }
      return true;
    });
  }, [screenshots, deferredSearchQuery, selectedCategory, selectedTag]);

  // Empty placeholder fetch function to maintain compatibility with other parts of the system
  const fetchScreenshots = async () => {};

  const toggleSelection = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleScreenshotClick = useCallback((s: Screenshot) => {
    setSelectedScreenshot(s);
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0 || !user) return;
    if (!confirm(`Hapus ${selectedItems.size} item terpilih?`)) return;
    
    try {
      const itemsToDelete = Array.from(selectedItems);
      // Delete parallel records to avoid UI freeze
      for (const id of itemsToDelete) {
        const target = screenshots.find(s => s.id === id);
        if (target) {
          try {
            const fileUrl = target.imageUrl || target.url;
            if (fileUrl.includes('firebasestorage.googleapis.com')) {
              await deleteObject(ref(storage, fileUrl));
            } else {
              await fetch(`/api/screenshots?url=${encodeURIComponent(target.url)}`, { method: 'DELETE' });
            }
          } catch (e) {
            console.error('Failed to unlink bulk item', e);
          }
        }
        await deleteDoc(doc(db, 'users', user.uid, 'screenshots', id));
      }
      setSelectedItems(new Set());
    } catch (e) {
      console.error('Failed bulk delete', e);
    }
  };

  const checkApiKeyGuard = () => {
    let hasKey = false;
    try {
      const keysStr = localStorage.getItem('lenskeep_gemini_keys');
      if (keysStr) {
        const arr = JSON.parse(keysStr);
        if (Array.isArray(arr) && arr.length > 0 && arr.some(k => k.trim())) {
          hasKey = true;
        }
      }
    } catch {}
    if (!hasKey) {
      const legacyKey = getStoredPreference('lenskeep_gemini_key', '');
      if (legacyKey.trim()) hasKey = true;
    }

    if (!hasKey) {
      alert("API Key diperlukan untuk memindai");
      setShowApiKeyModal(true);
      return false;
    }
    return true;
  };

  const executeWithKeyRotationAndRetry = async (url: string, model: string): Promise<any> => {
    const getKeys = (): string[] => {
      try {
        const keysStr = localStorage.getItem('lenskeep_gemini_keys');
        if (keysStr) {
          const arr = JSON.parse(keysStr);
          if (Array.isArray(arr) && arr.length > 0) {
            const validKeys = arr.filter(k => typeof k === 'string' && k.trim());
            if (validKeys.length > 0) return validKeys;
          }
        }
        const legacyKey = localStorage.getItem('lenskeep_gemini_key');
        if (legacyKey) return [legacyKey];
      } catch {}
      return [];
    };

    let keys = getKeys();
    if (keys.length === 0) {
      throw new Error('API_KEY_REQUIRED');
    }

    for (let attempt = 0; attempt < keys.length; attempt++) {
      const apikey = keys[attempt];
      try {
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apikey}`
          },
          body: JSON.stringify({ url, model, language, customPrompt }),
        });
        const data = await res.json();
        
        if (!res.ok) {
          const errText = String(data.error || '').toLowerCase();
          const needsRotation = res.status === 429 || errText.includes('quota') || errText.includes('exhausted') || errText.includes('429') || errText.includes('too many requests');
          
          if (needsRotation && attempt < keys.length - 1) {
            continue; // Retry with next key in array
          }
        }
        
        if (attempt > 0) {
           const newKeys = [...keys.slice(attempt), ...keys.slice(0, attempt)];
           localStorage.setItem('lenskeep_gemini_keys', JSON.stringify(newKeys));
        }

        return { res, data }; // Success or other error (or single key fail)
      } catch (err) {
        throw err; // Network failure or proxy 500 error; abort iterating keys immediately to prevent burn
      }
    }

    throw new Error('ALL_KEYS_EXHAUSTED');
  };

  // Handle Drag Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
      setIsUploadCollapsed(false);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Drag and drop directory scraper & multi-file standard grabber
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (!checkApiKeyGuard()) return;

    const files: File[] = [];
    const traversePromises: Promise<void>[] = [];

    if (e.dataTransfer.items) {
      for (let i = 0; i < e.dataTransfer.items.length; i++) {
        const item = e.dataTransfer.items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry) {
            traversePromises.push(traverseFileTree(entry, files));
          } else {
            const file = item.getAsFile();
            if (file && file.type.startsWith('image/')) {
              files.push(file);
            }
          }
        }
      }

      if (traversePromises.length > 0) {
        await Promise.all(traversePromises);
      }
    } else if (e.dataTransfer.files) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file.type.startsWith('image/')) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      await uploadMultipleFiles(files);
    } else {
      alert('No valid image files detected in the dropped content.');
    }
  };

  // Helper method to recursively digest a dropped filesystem tree
  const traverseFileTree = async (entry: any, fileList: File[]): Promise<void> => {
    return new Promise((resolve) => {
      if (entry.isFile) {
        entry.file((file: File) => {
          if (file.type.startsWith('image/')) {
            fileList.push(file);
          }
          resolve();
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const readEntries = () => {
          dirReader.readEntries(async (entries: any[]) => {
            if (entries.length === 0) {
              resolve();
              return;
            }
            const promises = entries.map((childEntry) => traverseFileTree(childEntry, fileList));
            await Promise.all(promises);
            readEntries();
          }, () => resolve());
        };
        readEntries();
      } else {
        resolve();
      }
    });
  };

  // Handle Multi-file selection change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!checkApiKeyGuard()) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.type.startsWith('image/')) {
          files.push(file);
        }
      }
      if (files.length > 0) {
        await uploadMultipleFiles(files);
      } else {
        alert('Please select valid image files (PNG, JPG, WEBP, etc.)');
      }
    }
  };

  // Handle Folder selection change
  const handleFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!checkApiKeyGuard()) {
      if (folderInputRef.current) folderInputRef.current.value = '';
      return;
    }
    if (e.target.files && e.target.files.length > 0) {
      const files: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        if (file.type.startsWith('image/')) {
          files.push(file);
        }
      }
      if (files.length > 0) {
        await uploadMultipleFiles(files);
      } else {
        alert('No valid image files found in the chosen folder.');
      }
    }
  };

  // Core concurrently managed upload runner (concurrency level: 3)
  const uploadMultipleFiles = async (files: File[]) => {
    setUploading(true);
    
    const initialQueue: QueueItem[] = files.map((file, idx) => ({
      id: `${Date.now()}-${idx}`,
      name: file.name,
      size: file.size,
      status: 'pending',
      progressText: 'In queue...',
    }));

    setUploadQueue(initialQueue);
    setQueueSummary({
      total: files.length,
      completed: 0,
      errors: 0,
    });

    const activeUploadsLimit = 3;
    let index = 0;

    const runUpload = async (queueItemIndex: number): Promise<void> => {
      const file = files[queueItemIndex];
      const queueId = initialQueue[queueItemIndex].id;

      let fileToUpload = file;
      try {
        setUploadQueue(prev =>
          prev.map(item =>
            item.id === queueId
              ? { ...item, status: 'uploading', progressText: 'Compressing image...' }
              : item
          )
        );
        const options = {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          fileType: 'image/webp'
        };
        fileToUpload = await imageCompression(file, options) as File;
      } catch (err) {
        console.warn('Image compression validation failed. Aborting corrupted file.', err);
        setUploadQueue(prev =>
          prev.map(item =>
            item.id === queueId
              ? { ...item, status: 'error', progressText: 'Invalid or corrupt image format.' }
              : item
          )
        );
        setQueueSummary(prev => ({ ...prev, errors: prev.errors + 1 }));
        
        const nextIndex = queueItemIndex + 1;
        if (nextIndex < files.length) {
          runUpload(nextIndex);
        } else {
          setUploading(false);
          await fetchScreenshots();
        }
        return;
      }

      setUploadQueue(prev =>
        prev.map(item =>
          item.id === queueId
            ? { ...item, status: 'uploading', progressText: 'Uploading to Firebase...' }
            : item
        )
      );

      try {
        if (!user) throw new Error("User not authenticated.");

        // Upload to Firebase Storage
        const uuid = Date.now().toString() + '-' + Math.round(Math.random() * 1000);
        const storageRef = ref(storage, `users/${user.uid}/images/${uuid}.webp`);
        await uploadBytes(storageRef, fileToUpload);
        const persistentUrl = await getDownloadURL(storageRef);

        setUploadQueue(prev =>
          prev.map(item =>
            item.id === queueId
              ? { ...item, status: 'uploading', progressText: 'Analyzing with Gemini...' }
              : item
          )
        );

        let ocrResult = { extractedText: '', tags: [], category: 'Other', summary: '' };
        let finalStatus = 'completed';

        try {
          const { res, data } = await executeWithKeyRotationAndRetry(persistentUrl, selectedModel);
          if (res.ok && data.success) {
            ocrResult = data.result || {};
          } else {
             console.error("Gemini analysis failed:", data);
             finalStatus = 'error';
          }
        } catch (e) {
          console.error("Gemini request threw error:", e);
          finalStatus = 'error';
        }

        setUploadQueue(prev =>
          prev.map(item =>
            item.id === queueId
              ? { ...item, status: 'uploading', progressText: 'Saving in database...' }
              : item
          )
        );

        // Write metadata document immediately into user's nested Firestore screenshots subcollection
        await setDoc(doc(db, 'users', user.uid, 'screenshots', uuid), {
          id: uuid,
          userId: user.uid,
          url: persistentUrl,
          imageUrl: persistentUrl,
          status: finalStatus,
          text: ocrResult.extractedText || '',
          tags: ocrResult.tags || [],
          category: ocrResult.category || 'Other',
          summary: ocrResult.summary || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setUploadQueue(prev =>
          prev.map(item =>
            item.id === queueId
              ? { ...item, status: finalStatus === 'completed' ? 'completed' : 'error', progressText: finalStatus === 'completed' ? 'Saved successfully!' : 'Analysis failed, but saved.' }
              : item
          )
        );
        
        if (finalStatus === 'completed') {
          setQueueSummary(prev => ({ ...prev, completed: prev.completed + 1 }));
        } else {
          setQueueSummary(prev => ({ ...prev, errors: prev.errors + 1 }));
        }
      } catch (err) {
        console.error('File upload failed:', err);
        setUploadQueue(prev =>
          prev.map(item =>
            item.id === queueId
              ? { ...item, status: 'error', progressText: 'Database save failed.' }
              : item
          )
        );
        setQueueSummary(prev => ({ ...prev, errors: prev.errors + 1 }));
      }
    };

    const workers: Promise<void>[] = [];
    const runNext = async (): Promise<void> => {
      if (index >= files.length) return;
      const currentIndex = index++;
      await runUpload(currentIndex);
      await runNext();
    };

    for (let w = 0; w < Math.min(activeUploadsLimit, files.length); w++) {
      workers.push(runNext());
    }

    await Promise.all(workers);
    setUploading(false);
  };

  // Sync Library - processes all pending/error screenshots sequentially with Gemini API
  const syncLibrary = async () => {
    if (!checkApiKeyGuard()) return;

    const pendingScreenshots = screenshots.filter(s => s.status === 'pending' || s.status === 'error');
    if (pendingScreenshots.length === 0) {
      alert('Folders are fully synchronized! All screenshots are analyzed.');
      return;
    }

    setSyncStatus({
      isSyncing: true,
      total: pendingScreenshots.length,
      completed: 0,
      failed: 0,
      currentItem: '',
    });

    if (!user) return;
    for (let i = 0; i < pendingScreenshots.length; i++) {
      const current = pendingScreenshots[i];
      const name = current.url.replace('/uploads/', '');

      setSyncStatus(prev => ({
        ...prev,
        currentItem: name,
      }));

      // Write processing state to Firestore
      try {
        await updateDoc(doc(db, 'users', user.uid, 'screenshots', current.id), {
          status: 'processing',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/screenshots/${current.id}`);
      }

      try {
        const { res, data } = await executeWithKeyRotationAndRetry(current.url, selectedModel);

        if (res.ok && data.success) {
          // Write compiled OCR outcomes back to Firestore
          await updateDoc(doc(db, 'users', user.uid, 'screenshots', current.id), {
            text: data.result.extractedText || '',
            tags: data.result.tags || [],
            category: 'Other',
            summary: data.result.summary || '',
            status: 'completed',
            updatedAt: serverTimestamp(),
          });
          
          setSyncStatus(prev => ({
            ...prev,
            completed: prev.completed + 1,
          }));
        } else {
          // Write analysis error status back to Firestore
          await updateDoc(doc(db, 'users', user.uid, 'screenshots', current.id), {
            status: 'error',
            text: `Error: ${data.error || 'AI sync skipped'}`,
            summary: 'Failed to analyze screenshot.',
            updatedAt: serverTimestamp(),
          });

          setSyncStatus(prev => ({
            ...prev,
            failed: prev.failed + 1,
          }));

          if (res.status === 401 || res.status === 403 || data.error?.includes('API_KEY_INVALID')) {
            alert('API Key Anda tidak valid atau ditolak. Mohon cek kembali di Pengaturan.');
            setShowApiKeyModal(true);
            break;
          }

          const errText = String(data.error || '').toLowerCase();
          if (errText.includes('quota') || errText.includes('exhausted') || errText.includes('429')) {
            alert('Batch synchronization paused: Gemini API daily quota or rate limit exceeded across all available keys.');
            break;
          }
        }
      } catch (err: any) {
        console.error('Error during batch analysis cycle:', err);
        setSyncStatus(prev => ({
          ...prev,
          failed: prev.failed + 1,
        }));
      }

      // Safe pace interval spacing to safeguard rate limit threshold
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    setSyncStatus(prev => ({
      ...prev,
      isSyncing: false,
    }));

    await fetchScreenshots();
  };

  // Run manual analysis on a single screenshot using Firestore
  const runManualAnalysis = async (id: string) => {
    if (!user) return;
    if (!checkApiKeyGuard()) return;

    setAnalyzingId(id);

    const targetScreenshot = screenshots.find(s => s.id === id);
    if (!targetScreenshot) {
      setAnalyzingId(null);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid, 'screenshots', id), {
        status: 'processing',
        updatedAt: serverTimestamp(),
      });

      const { res, data } = await executeWithKeyRotationAndRetry(targetScreenshot.url, selectedModel);

      if (res.ok && data.success) {
        await updateDoc(doc(db, 'users', user.uid, 'screenshots', id), {
          text: data.result.extractedText || '',
          tags: data.result.tags || [],
          category: 'Other',
          summary: data.result.summary || '',
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
      } else {
        const errorMsg = data.error || 'Analysis failed';
        await updateDoc(doc(db, 'users', user.uid, 'screenshots', id), {
          status: 'error',
          text: `Analysis failed: ${errorMsg}`,
          summary: 'Failed to analyze screenshot with Gemini AI.',
          updatedAt: serverTimestamp(),
        });
        
        if (res.status === 401 || res.status === 403 || data.error?.includes('API_KEY_INVALID')) {
          alert('API Key Anda tidak valid atau ditolak. Mohon cek kembali di Pengaturan.');
          setShowApiKeyModal(true);
        }
      }
    } catch (err) {
      console.error('Manual analyze connection error:', err);
    } finally {
      setAnalyzingId(null);
    }
  };

  // Delete Screenshot from Firestore and unlink physical disk file
  const handleDeleteScreenshot = async (id: string, e?: React.MouseEvent) => {
    if (!user) return;
    if (e) {
      e.stopPropagation();
    }
    if (!confirm('Are you sure you want to delete this screenshot?')) return;

    const targetScreenshot = screenshots.find(s => s.id === id);
    if (!targetScreenshot) return;

    try {
      const fileUrl = targetScreenshot.imageUrl || targetScreenshot.url;
      if (fileUrl.includes('firebasestorage.googleapis.com')) {
        await deleteObject(ref(storage, fileUrl));
      } else {
        await fetch(`/api/screenshots?url=${encodeURIComponent(targetScreenshot.url)}`, { method: 'DELETE' });
      }

      // 2. Delete document in Firestore
      await deleteDoc(doc(db, 'users', user.uid, 'screenshots', id));
      
      if (selectedScreenshot?.id === id) {
        setSelectedScreenshot(null);
      }
    } catch (error) {
      console.error('Failed to delete screenshot:', error);
    }
  };

  // Clear All Screenshots from Firestore and unlink all physical disk files
  const handleClearAllScreenshots = async () => {
    if (!user) return;
    setIsClearingAll(true);
    try {
      for (const s of screenshots) {
        const fileUrl = s.imageUrl || s.url;
        if (fileUrl && fileUrl.includes('firebasestorage.googleapis.com')) {
          try { await deleteObject(ref(storage, fileUrl)); } catch(e) {}
        }
      }
      // 1. Unlink all physical image files on server (Legacy)
      await fetch('/api/screenshots?all=true', {
        method: 'DELETE',
      });

      // 2. Delete all screenshots in user's subcollection list
      for (const s of screenshots) {
        await deleteDoc(doc(db, 'users', user.uid, 'screenshots', s.id));
      }

      setSelectedScreenshot(null);
      setShowConfirmClearAll(false);
    } catch (error) {
      console.error('Failed to clear all screenshots:', error);
    } finally {
      setIsClearingAll(false);
    }
  };

  // Keyboard Shortcuts (Ctrl+S for Sync, Delete/Backspace for selected item)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        const isEditable = activeEl.getAttribute('contenteditable') === 'true';
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || isEditable) {
          return;
        }
      }

      // Ctrl + S (or Cmd + S) to Sync All
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        syncLibrary();
      }

      // Delete/Backspace for selected item removal
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedScreenshot) {
          e.preventDefault();
          handleDeleteScreenshot(selectedScreenshot.id);
        }
      }

      // Left/Right arrow keys for details navigation
      if (e.key === 'ArrowLeft') {
        if (selectedScreenshot) {
          e.preventDefault();
          const currentIndex = screenshots.findIndex((s) => s.id === selectedScreenshot.id);
          if (currentIndex > -1) {
            const prevIndex = (currentIndex - 1 + screenshots.length) % screenshots.length;
            setSelectedScreenshot(screenshots[prevIndex]);
          }
        }
      }
      if (e.key === 'ArrowRight') {
        if (selectedScreenshot) {
          e.preventDefault();
          const currentIndex = screenshots.findIndex((s) => s.id === selectedScreenshot.id);
          if (currentIndex > -1) {
            const nextIndex = (currentIndex + 1) % screenshots.length;
            setSelectedScreenshot(screenshots[nextIndex]);
          }
        }
      }
      if (e.key === 'Escape') {
        if (selectedScreenshot) {
          e.preventDefault();
          setSelectedScreenshot(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedScreenshot, screenshots, syncStatus, syncLibrary, handleDeleteScreenshot]);

  // Extract unique categories and tags for client sidebar/filter buttons
  const categories = [
    'all',
    'Dashboard/Analytics',
    'Code/Terminal',
    'Social Media/Chat',
    'Receipt/Invoice',
    'Design Mockup',
    'Article/Reading',
    'Settings/System UI',
    'Other',
    'Error'
  ];

  // Get all unique tags from currently fetched list of screenshots
  const allUniqueTags = useMemo(() => Array.from(
    new Set(screenshots.flatMap((s) => s.tags || []))
  ).filter(Boolean), [screenshots]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopiedText(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  if (authLoading || (user && !userProfile) || (userProfile && userProfile.emailVerified === false)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-805 dark:text-slate-100" id="app-boot-loader">
        <div className="space-y-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400 mx-auto" />
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-slate-400">Securing Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100" id="lenskeep-app">
      {/* Top Header navbar with subtle subtle glow and micro shadow */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/85 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md px-4 md:px-6 py-3 md:py-4 flex items-center justify-between" id="app-header">
        <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
          <div className="relative flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/55 shadow-sm overflow-hidden shrink-0" id="brand-logo">
            <Image
              src="/lenskeep_brand_logo.png"
              alt="LensKeep Logo"
              fill
              priority
              className="object-contain p-1"
              id="lenskeep-header-logo-img"
              referrerPolicy="no-referrer"
            />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 md:h-2.5 md:w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 md:h-2.5 md:w-2.5 bg-violet-500"></span>
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none whitespace-nowrap">{t('header.title')}</h1>
            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1 hidden sm:block truncate">{t('header.subtitle')}</p>
          </div>
        </div>

        {/* Global actions and indicators */}
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
          {/* Language Switcher */}
          <button
            onClick={() => changeLanguage(language === 'en' ? 'id' : 'en')}
            className="hidden md:flex items-center justify-center space-x-1.5 p-2 md:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-all cursor-pointer border border-slate-200/40 dark:border-slate-700/50 shadow-sm shrink-0"
            title="Switch Language"
          >
            <Globe className="w-4.5 h-4.5 md:w-4 md:h-4" />
            <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{language}</span>
          </button>

          {/* Settings / API Key Button */}
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="hidden md:flex items-center justify-center p-2 md:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-all cursor-pointer border border-slate-200/40 dark:border-slate-700/50 shadow-sm shrink-0"
            title={t('header.api_key_tooltip')}
          >
            <Key className="w-4.5 h-4.5 md:w-4 md:h-4" />
          </button>

          {/* Dark Mode Toggle Button */}
          <button
            onClick={toggleDarkMode}
            className="hidden md:flex items-center justify-center p-2 md:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 transition-all cursor-pointer border border-slate-200/40 dark:border-slate-700/50 shadow-sm shrink-0"
            id="theme-toggle-btn"
            title={darkMode ? t('header.switch_light') : t('header.switch_dark')}
          >
            {darkMode ? (
              <Sun className="w-4.5 h-4.5 md:w-4 md:h-4 text-amber-400 font-bold animate-[spin_6s_linear_infinite]" />
            ) : (
              <Moon className="w-4.5 h-4.5 md:w-4 md:h-4 text-indigo-600 font-bold" />
            )}
          </button>

          <div className="hidden md:flex items-center px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50 shrink-0" id="stats-counter">
            <Layers className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
            <span>{screenshots.length} {t('header.stats_stored')}</span>
          </div>

          {user && (
            <div className="hidden md:flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-1.5 lg:pl-3 ml-0.5 shrink-0" id="user-header-tray-desktop">
              <span className="hidden lg:inline text-xs font-extrabold text-slate-500 dark:text-slate-400 max-w-[100px] truncate" title={user.displayName || user.email || ''}>
                {user.displayName || user.email?.split('@')[0] || 'User'}
              </span>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="flex items-center justify-center p-2 md:p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/20 dark:hover:text-rose-400 transition-all cursor-pointer border border-slate-200/40 dark:border-slate-700/50 shadow-sm text-slate-600 dark:text-slate-200 shrink-0"
                title={t('header.logout')}
                id="header-logout-btn-desktop"
              >
                <LogOut className="w-4.5 h-4.5 md:w-4 md:h-4" />
              </button>
            </div>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1 p-2 md:px-3 md:py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white text-xs font-bold rounded-xl shadow-md cursor-pointer active:scale-95 whitespace-nowrap shrink-0 ml-1.5 md:ml-0"
            id="header-upload-btn"
          >
            <Upload className="w-4.5 h-4.5 md:w-3.5 md:h-3.5" />
            <span className="hidden md:inline">{t('header.files')}</span>
          </button>

          <button
            onClick={() => folderInputRef.current?.click()}
            className="hidden sm:flex items-center justify-center gap-1 p-2 md:px-3 md:py-2 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/65 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40 transition-colors text-xs font-bold rounded-xl cursor-pointer active:scale-95 whitespace-nowrap animate-pulse shrink-0"
            id="header-folder-upload-btn"
            title="Upload whole folder of screenshots at once"
          >
            <Layers className="w-4.5 h-4.5 md:w-3.5 md:h-3.5" />
            <span className="hidden md:inline">{t('header.folder')}</span>
          </button>

          {/* Mobile Hamburger Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden flex items-center justify-center p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 border border-slate-200/40 dark:border-slate-700/50 shadow-sm shrink-0"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <div 
              className="md:hidden fixed inset-0 z-30" 
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden fixed top-[72px] right-4 z-40 w-56 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-4 flex flex-col gap-4"
            >
              {/* Language Switcher */}
              <button
                onClick={() => { changeLanguage(language === 'en' ? 'id' : 'en'); setIsMobileMenuOpen(false); }}
                className="flex items-center space-x-3 w-full text-left text-slate-700 dark:text-slate-200"
              >
                <Globe className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-semibold">{language === 'en' ? 'Switch to Bahasa' : 'Switch to English'}</span>
              </button>

              {/* API Key Modal */}
              <button
                onClick={() => { setShowApiKeyModal(true); setIsMobileMenuOpen(false); }}
                className="flex items-center space-x-3 w-full text-left text-slate-700 dark:text-slate-200"
              >
                <Key className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-semibold">{t('header.api_key_tooltip')}</span>
              </button>

              {/* Dark Mode Toggle Button */}
              <button
                onClick={() => { toggleDarkMode(); setIsMobileMenuOpen(false); }}
                className="flex items-center space-x-3 w-full text-left text-slate-700 dark:text-slate-200"
              >
                {darkMode ? <Sun className="w-5 h-5 flex-shrink-0 text-amber-400" /> : <Moon className="w-5 h-5 flex-shrink-0 text-indigo-600" />}
                <span className="text-sm font-semibold">{darkMode ? t('header.switch_light') : t('header.switch_dark')}</span>
              </button>

              {user && (
                <>
                  <div className="h-px w-full bg-slate-200 dark:bg-slate-800 my-1" />
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-1 truncate">
                      {user.displayName || user.email || 'User'}
                    </span>
                    <button
                      onClick={() => { setShowLogoutConfirm(true); setIsMobileMenuOpen(false); }}
                      className="flex items-center space-x-3 w-full text-left text-rose-600 dark:text-rose-450 hover:text-rose-700 dark:hover:text-rose-400"
                      id="header-logout-btn-mobile"
                    >
                      <LogOut className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-semibold">{t('header.logout')}</span>
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main workspace layout */}

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 flex flex-col space-y-6 md:space-y-8" id="app-main-workspace">
        
        {/* API Key Modal */}
        <ApiKeyModal 
          show={showApiKeyModal} 
          onClose={() => setShowApiKeyModal(false)}
          apiKeys={apiKeys} 
          setApiKeys={setApiKeys}
          customPrompt={customPrompt}
          setCustomPrompt={setCustomPrompt} 
          t={t} 
        />

        {/* Gemini Quota Alert Banner */}
        <QuotaAlertBanner 
          screenshots={screenshots} 
          selectedModel={selectedModel} 
          setSelectedModel={setSelectedModel} 
          setScreenshots={setScreenshots} 
        />

        {/* Sleek toggleable/collapsible Upload panel wrapper */}
        <div className="flex flex-col space-y-3" id="upload-panel-container">
          <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-850 dark:text-white tracking-tight leading-none">{t('dropzone.add_title')}</h3>
                <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 mt-1">{t('dropzone.add_desc')}</p>
              </div>
            </div>
            
            <button
              onClick={() => setIsUploadCollapsed(!isUploadCollapsed)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer select-none active:scale-95"
            >
              {isUploadCollapsed ? (
                <>
                  <Upload className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{t('dropzone.expand')}</span>
                </>
              ) : (
                <>
                  <X className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span>{t('dropzone.collapse')}</span>
                </>
              )}
            </button>
          </div>

          {/* Hidden Inputs (Must remain mounted for external triggers) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            multiple
            className="hidden"
            id="screenshot-file-input"
          />
          <input
            type="file"
            ref={folderInputRef}
            onChange={handleFolderChange}
            {...{ webkitdirectory: "", directory: "" }}
            multiple
            className="hidden"
            id="screenshot-folder-input"
          />

          <AnimatePresence initial={false}>
            {!isUploadCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                {/* Step 1: Upload Drag and Drop Area */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-5 md:p-10 text-center ${
                    dragActive
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20 scale-[1.01]'
                      : uploading
                      ? 'border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 shadow-sm'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-400/80 dark:hover:border-slate-600 hover:shadow-sm'
                  }`}
                  id="dropzone"
                >
                  <AnimatePresence mode="wait">
                    {uploading ? (
                      <motion.div
                        key="uploading-state"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-col items-center py-4"
                        id="uploading-feedback"
                      >
                        <div className="relative mb-4 flex items-center justify-center">
                          <div className="absolute w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-full animate-ping opacity-60"></div>
                          <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin relative z-10" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Processing Batch Upload</h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 max-w-md">
                          Scanning, compiling, and analyzing indices concurrently via Gemini-3.5-Flash.
                        </p>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="idle-state"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center select-none py-2 w-full"
                        id="upload-prompt"
                      >
                        <div className="p-3 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100/50 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-400 transition-colors mb-4">
                          <Upload className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 text-center px-4">
                          {t('dropzone.drop_here')}
                        </h3>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center">
                          {t('dropzone.or')}
                        </p>
                        
                        {/* Visual selectors for intuitive clicking */}
                        <div className="mt-4 flex flex-col md:flex-row items-center justify-center gap-2 md:gap-3 w-full md:w-auto px-4 md:px-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="flex items-center justify-center w-full md:w-auto space-x-2 md:space-x-1.5 px-4 md:px-3.5 py-3 md:py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white text-sm md:text-xs font-bold rounded-xl shadow-md transition-colors cursor-pointer active:scale-95"
                          >
                            <Upload className="w-5 h-5 md:w-3.5 md:h-3.5" />
                            <span>{t('dropzone.choose_files')}</span>
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); folderInputRef.current?.click(); }}
                            className="flex items-center justify-center w-full md:w-auto space-x-2 md:space-x-1.5 px-4 md:px-3.5 py-3 md:py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 text-sm md:text-xs font-bold rounded-xl transition-colors cursor-pointer active:scale-95 shadow-sm"
                          >
                            <Layers className="w-5 h-5 md:w-3.5 md:h-3.5" />
                            <span>{t('dropzone.choose_folder')}</span>
                          </button>
                        </div>

                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 max-w-lg px-6">
                          {t('dropzone.supports')}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Real-Time Upload Queue Progress Widget */}
        {uploadQueue.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 shadow-sm space-y-4" id="upload-queue-card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="flex items-center space-x-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Layers className="w-3.5 h-3.5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Batch Processing Queue</h3>
                  <p className="text-[10px] text-slate-400">Concurrency active: Up to 3 parallel workers</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {queueSummary.completed} Done
                </span>
                {queueSummary.errors > 0 && (
                  <span className="flex items-center text-rose-600 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" /> {queueSummary.errors} Error
                  </span>
                )}
                <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-1 rounded-md">
                  Total: {queueSummary.total} files
                </span>
                {!uploading && (
                  <button
                    onClick={() => setUploadQueue([])}
                    className="ml-1 text-xs text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer font-bold"
                  >
                    Clear Queue
                  </button>
                )}
              </div>
            </div>

            {/* Total progress bar tracker */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative border border-slate-200/40">
              <div
                className="bg-indigo-600 h-full transition-all duration-500 rounded-full"
                style={{ width: `${((queueSummary.completed + queueSummary.errors) / queueSummary.total) * 100}%` }}
              ></div>
            </div>

            {/* Scrollable grid file list items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1" id="queue-files-list">
              {uploadQueue.map((item) => (
                <div key={item.id} className="p-3 bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl flex items-center justify-between text-xs transition-all">
                  <div className="space-y-1 overflow-hidden pr-2 flex-1">
                    <p className="font-bold text-slate-700 truncate" title={item.name}>
                      {item.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {(item.size / 1024).toFixed(1)} KB &bull; <span className={
                        item.status === 'completed' ? 'text-emerald-600 font-bold' :
                        item.status === 'error' ? 'text-rose-500 font-bold' :
                        item.status === 'uploading' ? 'text-indigo-600 font-semibold animate-pulse' : 'text-slate-400'
                      }>{item.progressText}</span>
                    </p>
                  </div>
                  <div className="shrink-0 ml-1">
                    {item.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    {item.status === 'error' && <AlertCircle className="w-4 h-4 text-rose-500" />}
                    {item.status === 'uploading' && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />}
                    {item.status === 'pending' && <Clock className="w-4 h-4 text-slate-300 animate-pulse" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Sleek Control Bar: Search and Collapsible Filters */}
        <section className="bg-white rounded-2xl border border-slate-200/80 p-4 md:p-5 flex flex-col space-y-0.5 shadow-sm transition-all" id="search-section">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-base md:text-sm font-medium"
                id="search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 text-slate-500 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Actions Array */}
            <div className="flex items-center gap-2 shrink-0 animate-fade-in overflow-x-auto pb-1 md:pb-0 scrollbar-hide w-full md:w-auto">
              {/* Model Switcher Dropdown */}
              <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-2 py-2.5 shadow-sm" id="model-switcher-dropdown">
                <Sparkles className="w-3.5 h-2.5 text-indigo-500 animate-pulse" />
                <span className="text-[10px] uppercase font-black text-slate-400 select-none hidden md:inline">{t('library.ai_engine')}:</span>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-transparent text-base md:text-xs font-bold text-slate-750 focus:outline-none cursor-pointer pr-1"
                >
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash (Default)</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Lite (Highly Resource-Efficient)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Full-Powered / Paid Key)</option>
                </select>
              </div>

              <div className="flex border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 transition-all cursor-pointer active:scale-95 ${viewMode === 'grid' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold' : 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <div className="w-px bg-slate-200 dark:bg-slate-800"></div>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 transition-all cursor-pointer active:scale-95 ${viewMode === 'list' ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold' : 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all border active:scale-95 ${
                  showFilters
                    ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 font-extrabold'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm'
                }`}
                id="toggle-filters-btn"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{t('library.filters')}</span>
                {(selectedCategory !== 'all' || selectedTag !== 'all') && (
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-600"></span>
                  </span>
                )}
              </button>

              {/* Clear Filters Indicator */}
              {(selectedCategory !== 'all' || selectedTag !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedTag('all');
                    setSearchQuery('');
                  }}
                  className="flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-205 transition-colors text-xs font-bold text-slate-600 rounded-xl cursor-pointer shrink-0 border border-slate-200/40"
                  id="clear-filters-btn"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{t('library.reset_filters')}</span>
                </button>
              )}

              {/* Clear All Screenshots Button */}
              {screenshots.length > 0 && (
                <button
                  onClick={() => setShowConfirmClearAll(true)}
                  className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/25 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-300 border border-rose-200/50 dark:border-rose-900/30 text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-95 shadow-sm shrink-0"
                  id="clear-all-screenshots-btn"
                  title="Clear all stored screenshots from index and disk"
                  type="button"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('library.clear_all')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Collapsible/Expandable Integrated Filters Panel */}
          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-4 text-xs pt-4 border-t border-slate-100 mt-3">
                  {/* Category Filter Cards */}
                  <div className="flex flex-col space-y-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Filter by Category:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => {
                        const isActive = selectedCategory.toLowerCase() === cat.toLowerCase();
                        return (
                          <button
                            key={cat}
                            onClick={() => setSelectedCategory(cat.toLowerCase())}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-sm font-extrabold'
                                : 'bg-slate-50 hover:bg-slate-100/85 text-slate-650 border border-slate-150'
                            }`}
                          >
                            {cat === 'all' ? 'All Classes' : cat}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tag Cloud Selector */}
                  {allUniqueTags.length > 0 && (
                    <div className="flex flex-col space-y-2 pt-1">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Filter by Tags:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setSelectedTag('all')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer border transition-colors ${
                            selectedTag === 'all'
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-750 font-extrabold'
                              : 'bg-white border-slate-205 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          All Tags
                        </button>
                        {allUniqueTags.map((tag) => {
                          const isActive = selectedTag.toLowerCase() === tag.toLowerCase();
                          return (
                            <button
                              key={tag}
                              onClick={() => setSelectedTag(isActive ? 'all' : tag)}
                              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer border transition-colors ${
                                isActive
                                  ? 'bg-indigo-50 border-indigo-200 text-indigo-750 font-extrabold'
                                  : 'bg-white border-slate-150 text-slate-500 hover:text-indigo-600 hover:border-indigo-150'
                              }`}
                            >
                              #{tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Step 3: Screenshot Gallery Display Grid */}
        <section className="flex flex-col space-y-4" id="gallery-section">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-150 pb-3" id="library-controls-bar">
            {/* Library Counter - Left Side */}
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">{t('library.title')}</h2>
              <span className="bg-slate-100 text-slate-500 text-xs font-black px-2.5 py-0.5 rounded-md">
                {screenshots.length}
              </span>
            </div>

            {/* Controls panel - Right Side */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Sync Folder Button */}
              {(() => {
                const pendingCount = screenshots.filter(
                  (s) => s.status === 'pending' || s.status === 'error'
                ).length;
                return (
                  <button
                    onClick={syncLibrary}
                    disabled={syncStatus.isSyncing}
                    title="Synchronize all screenshots [Ctrl+S]"
                    className={`flex items-center space-x-1.5 px-4 py-1.5 text-xs font-bold rounded-lg border transition-all active:scale-95 cursor-pointer shadow-sm ${
                      syncStatus.isSyncing
                        ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-500 hover:border-indigo-600"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{t('library.sync_folder')}</span>
                    {pendingCount > 0 && !syncStatus.isSyncing && (
                      <span className="ml-1 bg-white text-indigo-700 font-extrabold text-[10px] px-1.5 py-0.1 rounded-full border border-indigo-100 animate-pulse">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>

          {loading ? (
            /* Skeleton grid loader */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="skeleton-grid">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white rounded-2xl border border-slate-200/60 p-4 h-72 animate-pulse flex flex-col justify-between">
                  <div className="w-full h-40 bg-slate-100 rounded-lg"></div>
                  <div className="space-y-2 mt-4 flex-1">
                    <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                    <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredScreenshots.length === 0 ? (
            /* Elegant empty state */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-8 md:p-16 text-center shadow-sm max-w-xl mx-auto w-full my-4 flex flex-col items-center" id="empty-gallery">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-805 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">No screenshots matched</h3>
              <p className="text-sm text-slate-505 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
                {searchQuery || selectedCategory !== 'all' || selectedTag !== 'all'
                  ? 'Try relaxing your filter parameters, searching with simpler keywords, or refreshing the page.'
                  : 'Start uploading your first screen captures to unlock indexable OCR text capabilities, AI summaries, and tag management.'}
              </p>
              {(searchQuery || selectedCategory !== 'all' || selectedTag !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSelectedTag('all');
                    setSearchQuery('');
                  }}
                  className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 transition-colors text-white text-xs font-semibold rounded-lg cursor-pointer shadow-indigo-600/10"
                >
                  {t('library.reset_active')}
                </button>
              )}
            </div>
          ) : (
            /* Actual screenshot layout list */
            <div className="space-y-4 w-full">
              {/* Bulk Actions Menu Toolbar */}
              <AnimatePresence>
                {selectedItems.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50 dark:bg-indigo-950/20 border-l-4 border-l-indigo-500 border border-slate-200 dark:border-indigo-900/50 p-3 md:px-5 md:py-3.5 rounded-xl text-sm"
                  >
                    <div className="flex items-center space-x-3 text-indigo-800 dark:text-indigo-300 font-bold">
                      <span className="w-6 h-6 flex items-center justify-center bg-indigo-500 text-white rounded-full text-xs shrink-0 shadow-sm">{selectedItems.size}</span>
                      <span>Item Terpilih</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedItems(new Set())}
                        className="px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-450 border border-rose-200/50 dark:border-rose-900/40 text-xs font-bold rounded-lg cursor-pointer transition-all shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus Massal</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dynamic Grid vs List rendering container */}
              <div 
                className={viewMode === 'grid' 
                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3"
                  : "flex flex-col space-y-2 max-w-4xl"
                } 
                id="screenshots-gallery-view"
              >
                {filteredScreenshots.map((s) => (
                  <LibraryCard 
                    key={s.id} 
                    s={s} 
                    onClick={handleScreenshotClick} 
                    isSelected={selectedItems.has(s.id)}
                    onToggleSelect={toggleSelection}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Visual Overlay Modal matching lampiran2 exactly */}
      <AnimatePresence>
        {selectedScreenshot && (
          <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4 md:p-6" id="details-root">
            {/* Modal Backdrop dim with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedScreenshot(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md cursor-pointer"
            />

            {/* Previous Arrow - Left Edge */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const currentIndex = filteredScreenshots.findIndex((s) => s.id === selectedScreenshot.id);
                if (currentIndex > -1) {
                  const prevIndex = (currentIndex - 1 + filteredScreenshots.length) % filteredScreenshots.length;
                  setSelectedScreenshot(filteredScreenshots[prevIndex]);
                }
              }}
              className="absolute left-3 md:left-6 z-55 p-2.5 md:p-3.5 bg-slate-900/70 hover:bg-slate-800 border border-slate-755 text-white rounded-full transition-all cursor-pointer select-none active:scale-95 shadow-lg"
              title="Previous [Left Arrow]"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            {/* Next Arrow - Right Edge */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const currentIndex = filteredScreenshots.findIndex((s) => s.id === selectedScreenshot.id);
                if (currentIndex > -1) {
                  const nextIndex = (currentIndex + 1) % filteredScreenshots.length;
                  setSelectedScreenshot(filteredScreenshots[nextIndex]);
                }
              }}
              className="absolute right-3 md:right-6 z-55 p-2.5 md:p-3.5 bg-slate-900/70 hover:bg-slate-800 border border-slate-755 text-white rounded-full transition-all cursor-pointer select-none active:scale-95 shadow-lg"
              title="Next [Right Arrow]"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>

            {/* Central Modal Container Block */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl h-[80vh] md:h-[600px] bg-slate-900 border border-slate-805 text-white rounded-2xl flex flex-col md:flex-row overflow-hidden shadow-2xl z-40"
              id="details-panel"
            >
              {/* Left Side: Dynamic Image Viewer */}
              <div className="flex-1 bg-slate-950/40 flex items-center justify-center p-4 relative min-h-0">
                <img
                  src={selectedScreenshot.imageUrl || selectedScreenshot.url}
                  alt={selectedScreenshot.summary || 'Full view'}
                  className="max-w-full max-h-full object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />

                {/* Overlaid External Source Link */}
                <div className="absolute top-4 left-4 z-10">
                  <a
                    href={selectedScreenshot.url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 bg-slate-900/85 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold backdrop-blur-sm border border-slate-755 flex items-center space-x-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Original</span>
                  </a>
                </div>
              </div>

              {/* Right Side: Information Details Pane matching lampiran2 */}
              <div className="w-full md:w-[380px] shrink-0 bg-[#0c111d] p-6 flex flex-col justify-between overflow-y-auto border-t md:border-t-0 md:border-l border-slate-800 min-h-0 text-slate-200" id="modal-details-sidebar">
                
                <div className="space-y-6">
                  {/* Header/ID Block */}
                  <div className="flex items-start justify-between">
                    <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs md:text-sm font-black text-white truncate break-all block" title={selectedScreenshot.id}>
                          {selectedScreenshot.id}
                        </span>
                        <span className="bg-slate-800 text-slate-350 border border-slate-700 text-[10px] font-black px-2 py-0.5 rounded uppercase shrink-0">
                          {selectedScreenshot.category || 'Other'}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{formatDate(selectedScreenshot.createdAt)}, {formatTime(selectedScreenshot.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => handleDeleteScreenshot(selectedScreenshot.id)}
                        className="p-2.5 md:p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                        title="Delete screenshot index record"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                      <button
                        onClick={() => setSelectedScreenshot(null)}
                        className="p-2.5 md:p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg cursor-pointer transition-colors"
                        title="Close details"
                      >
                        <X className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-800"></div>

                  {/* Operational manual indexer for pending screens */}
                  {(selectedScreenshot.status === 'pending' || selectedScreenshot.status === 'error' || selectedScreenshot.status === 'processing') && (
                    <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-400">Classification Pending</span>
                        <span className="px-2 py-0.5 bg-slate-800 rounded font-black text-[9px] text-amber-400 uppercase tracking-widest">{selectedScreenshot.status}</span>
                      </div>
                      
                      {selectedScreenshot.status !== 'processing' ? (
                        <button
                          onClick={() => runManualAnalysis(selectedScreenshot.id)}
                          disabled={analyzingId === selectedScreenshot.id}
                          className="w-full mt-1 flex items-center justify-center space-x-2 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl cursor-pointer active:scale-[0.98] disabled:opacity-50 transition-all shadow-md shadow-indigo-600/10"
                        >
                          {analyzingId === selectedScreenshot.id ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Analysing components...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Process OCR with Gemini AI Now</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="w-full flex items-center justify-center space-x-2 py-2 bg-slate-805 text-slate-300 text-xs font-semibold rounded-xl animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-455" />
                          <span>Gemini scanning screenshot layout...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Insights Summary Block */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-1.5 text-indigo-400">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">AI INSIGHTS</span>
                    </div>
                    <div className="text-sm font-bold leading-relaxed text-white">
                      {selectedScreenshot.summary || 'No AI summary available yet.'}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal font-medium">
                      {selectedScreenshot.status === 'pending'
                        ? 'This screenshot has not been analyzed with Gemini AI yet. Toggle the sync folder or process it above.'
                        : selectedScreenshot.status === 'processing'
                        ? 'Gemini is running OCR extraction and summarization right now...'
                        : selectedScreenshot.status === 'error'
                        ? 'Index error occurred. Standard OCR retry possible.'
                        : 'OCR index and descriptive context generated successfully by Gemini-3.5-Flash.'}
                    </p>
                  </div>

                  {/* Tags Block */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <TagIcon className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider">TAGS</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedScreenshot.tags && selectedScreenshot.tags.length > 0 ? (
                        selectedScreenshot.tags.map((tag, i) => (
                          <span key={i} className="text-[11px] font-bold text-indigo-300 bg-indigo-950 border border-indigo-900/60 px-2.5 py-0.5 rounded-md">
                            #{tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500 italic">No tags generated yet.</span>
                      )}
                    </div>
                  </div>

                  {/* OCR Extracted Text */}
                  {selectedScreenshot.status !== 'pending' && selectedScreenshot.text && selectedScreenshot.text.trim().length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-850">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-extrabold text-[10px] uppercase tracking-wider flex items-center">
                          <FileText className="w-3.5 h-3.5 mr-1" /> OCR Extracted text
                        </span>
                        
                        {selectedScreenshot.text && (
                          <button
                            onClick={() => copyToClipboard(selectedScreenshot.text || '')}
                            className="flex items-center space-x-1 p-2 md:p-1.5 -mr-2 md:-mr-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors rounded-lg"
                          >
                            {copiedText ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      <pre className="w-full h-24 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-[10px] font-mono whitespace-pre-wrap break-all md:break-words overflow-y-auto leading-relaxed text-slate-350 select-text">
                        {selectedScreenshot.text || 'No searchable OCR text content component found in screen index.'}
                      </pre>
                    </div>
                  )}

                </div>

                {/* File Information Section */}
                <div className="pt-4 border-t border-slate-800 mt-6 space-y-2 text-[10px] font-semibold text-slate-505">
                  <span className="font-extrabold uppercase text-[9px] tracking-wider block">FILE INFO</span>
                  <div className="flex justify-between font-mono text-slate-400">
                    <span>ID:</span>
                    <span className="truncate max-w-[200px]" title={selectedScreenshot.id}>{selectedScreenshot.id}</span>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Scroll To Top Button */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <button
              onClick={scrollToTop}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-transform active:scale-95 cursor-pointer"
              aria-label="Scroll to top"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Synchronization Progress Overlay */}
      <AnimatePresence>
        {syncStatus.isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 shadow-2xl space-y-3.5"
            id="sync-progress-toast"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                <span className="text-xs font-black uppercase tracking-widest text-slate-300">Synchronizing...</span>
              </div>
              <span className="text-xs font-bold font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                {syncStatus.completed + syncStatus.failed} / {syncStatus.total}
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Processing file</p>
              <p className="text-xs font-mono font-bold text-slate-200 truncate" title={syncStatus.currentItem}>
                {syncStatus.currentItem || 'Evaluating database elements...'}
              </p>
            </div>

            {/* Total progress tracker bar inside toast */}
            <div className="space-y-2">
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full transition-all duration-350 rounded-full"
                  style={{ width: `${((syncStatus.completed + syncStatus.failed) / syncStatus.total) * 100}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <span className="text-emerald-400 font-semibold">{syncStatus.completed} completed</span>
                {syncStatus.failed > 0 && <span className="text-rose-450 font-semibold">{syncStatus.failed} failed</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog for Clearing All Screenshots */}
      <AnimatePresence>
        {showConfirmClearAll && (
          <div className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center p-4 md:p-6" id="clear-all-confirm-root">
            {/* Modal Backdrop dim with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { if (!isClearingAll) setShowConfirmClearAll(false); }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md cursor-pointer"
            />

            {/* Confirmation Modal Content Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-2xl flex flex-col overflow-hidden shadow-2xl z-50 p-6 md:p-7 space-y-4"
            >
              <div className="flex items-center space-x-3 text-rose-500 dark:text-rose-450">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <h3 className="text-base md:text-lg font-bold tracking-tight text-slate-900 dark:text-white">Clear Screenshots Library</h3>
              </div>

              <div className="space-y-2 text-slate-600 dark:text-slate-300 text-xs md:text-sm leading-relaxed">
                <p>
                  Are you sure you want to delete <strong className="text-slate-900 dark:text-white font-extrabold">{screenshots.length}</strong> stored screenshot(s)?
                </p>
                <p className="text-[11px] bg-rose-50/70 dark:bg-rose-950/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-350 leading-normal">
                  ⚠️ This action is irreversible. All cached content, automatic summaries, categories, tags, and original image files will be permanently erased.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  disabled={isClearingAll}
                  onClick={() => setShowConfirmClearAll(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-slate-805 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200/50 dark:border-slate-700/50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isClearingAll}
                  onClick={handleClearAllScreenshots}
                  className="flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white hover:text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isClearingAll ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Clearing...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm, Clear All</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog for Log Out */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] overflow-hidden flex items-center justify-center p-4 md:p-6" id="logout-confirm-root">
            {/* Modal Backdrop dim with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md cursor-pointer"
            />

            {/* Confirmation Modal Content Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-2xl flex flex-col overflow-hidden shadow-2xl z-50 p-6 md:p-7 space-y-4"
            >
              <div className="flex items-center space-x-3 text-rose-500 dark:text-rose-450">
                <div className="p-2.5 bg-rose-50 dark:bg-rose-950/30 rounded-xl shrink-0">
                  <LogOut className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <h3 className="text-base md:text-lg font-bold tracking-tight text-slate-900 dark:text-white">Confirm Sign Out</h3>
              </div>

              <div className="space-y-2 text-slate-600 dark:text-slate-300 text-xs md:text-sm leading-relaxed">
                <p>
                  Are you sure you want to sign out?
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-slate-805 dark:hover:bg-slate-800 dark:text-slate-300 dark:hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer border border-slate-200/50 dark:border-slate-700/50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    logout();
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white hover:text-white text-xs font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Confirm Sign Out</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer bar */}
      <footer className="py-6 text-center border-t border-[#1e1d1d] mt-auto bg-[#0e0d0d] text-xs text-slate-400" id="app-footer">
        <p>&copy; {new Date().getFullYear()} LensKeep AI Screenshot Engine. All metadata processed via Gemini-3.5-Flash.</p>
      </footer>
    </div>
  );
}
