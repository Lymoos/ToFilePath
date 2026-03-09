import { createContext, useContext, useState, useEffect } from 'react'

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  en: {
    // Navbar
    'nav.tagline':      'Secure · Fast · Up to 30 GB',
    'nav.signIn':       'Sign In',
    'nav.myStorage':    'My Storage',
    'nav.signedInAs':   'Signed in as',
    'nav.clickSignOut': 'click to sign out',
    // Auth
    'auth.signIn':        'Sign In',
    'auth.createAccount': 'Create Account',
    'auth.welcomeBack':   'Welcome back',
    'auth.signInSub':     'Sign in to access your personal storage',
    'auth.createSub':     'Get 30 GB of secure personal storage — free',
    'auth.username':         'Username',
    'auth.usernameOrEmail':  'Username or email',
    'auth.email':            'Email',
    'auth.password':         'Password',
    'auth.confirmPassword':  'Confirm password',
    'auth.signingIn':        'Signing in…',
    'auth.creating':         'Creating account…',
    'auth.noAccount':        'No account?',
    'auth.signUpFree':       'Sign up free',
    'auth.haveAccount':      'Already registered?',
    'auth.signInLink':       'Sign in',
    // Storage
    'storage.root':           'Root',
    'storage.myStorage':      'My Storage',
    'storage.navigation':     'Navigation',
    'storage.newFolder':      'New Folder',
    'storage.upload':         'Upload',
    'storage.empty':          'This folder is empty',
    'storage.emptySub':       'Upload files or create a new folder to get started',
    'storage.folder':         'Folder',
    'storage.signOut':        'Sign out',
    'storage.dropToUpload':   'Drop files to upload',
    'storage.uploading':      'Uploading {n} {word}…',
    'storage.file':           'file',
    'storage.files':          'files',
    'storage.settings':       'Settings',
    'storage.downloadZip':    'Download as ZIP',
    'storage.preview':        'Preview',
    'storage.download':       'Download',
    'storage.delete':         'Delete',
    'storage.cancel':         'Cancel',
    'storage.used':           'used',
    'storage.storageLabel':   'Storage',
    'storage.foldersLabel':   'folders',
    'storage.clickToPreview': 'click to preview',
    'storage.justNow':        'just now',
    'storage.mAgo':           '{n}m ago',
    'storage.hAgo':           '{n}h ago',
    'storage.dAgo':           '{n}d ago',
    'storage.rename':         'Rename',
    'storage.renameFile':     'Rename File',
    'storage.renameFolder':   'Rename Folder',
    'storage.create':         'Create',
    'storage.creating':       'Creating…',
    'storage.uploadFolder':   'Upload folder',
    'storage.folderNamePlaceholder': 'Folder name',
    'storage.enterFolderName': 'Enter a folder name',
    'storage.noResults':      'No results found',
    'storage.noResultsSub':   'No files or folders matching "{q}"',
    // Settings
    'settings.title':        'Settings',
    'settings.account':      'Account',
    'settings.appearance':   'Appearance',
    'settings.security':     'Security',
    'settings.admin':        'Admin Panel',
    'settings.backToStorage':'← Back to Storage',
    'settings.memberSince':  'Member since',
    'settings.storageUsage': 'Storage Usage',
    'settings.fileCount':    'Files',
    'settings.folderCount':  'Folders',
    // Account
    'settings.changeEmail':          'Change Email',
    'settings.newEmail':             'New email address',
    'settings.currentPassword':      'Current Password',
    'settings.passwordForConfirm':   'Your password to confirm',
    'settings.saveEmail':            'Update Email',
    // Security
    'settings.changePassword':       'Change Password',
    'settings.oldPassword':          'Current Password',
    'settings.newPassword':          'New Password',
    'settings.confirmNewPassword':   'Confirm New Password',
    'settings.savePassword':         'Update Password',
    'settings.deleteAccount':        'Delete Account',
    'settings.deleteAccountWarn':    'This permanently deletes your account and ALL files. This cannot be undone.',
    'settings.typePasswordToDelete': 'Enter your password to confirm deletion',
    'settings.deleteAccountBtn':     'Permanently Delete Account',
    // Appearance
    'settings.language':        'Display Language',
    'settings.langEn':          'English',
    'settings.langRu':          'Русский',
    'settings.accentColor':     'Accent Color',
    'settings.compactMode':     'Compact Mode',
    'settings.compactDesc':     'Reduce spacing in file lists',
    'settings.animationsOff':   'Reduce Motion',
    'settings.animationsDesc':  'Disable non-essential animations',
    // Admin
    'settings.adminUsers':      'Registered Users',
    'settings.adminTotalFiles': 'Total Files Stored',
    'settings.adminStorage':    'Total Storage Used',
    'settings.adminAnonFiles':  'Anonymous Files',
    // Misc
    'misc.saved':  '✓ Saved',
    'misc.save':   'Save Changes',
    'misc.saving': 'Saving…',
    'misc.error':  'Error',
  },
  ru: {
    // Navbar
    'nav.tagline':      'Безопасно · Быстро · До 30 ГБ',
    'nav.signIn':       'Войти',
    'nav.myStorage':    'Моё хранилище',
    'nav.signedInAs':   'Вы вошли как',
    'nav.clickSignOut': 'нажмите для выхода',
    // Auth
    'auth.signIn':        'Войти',
    'auth.createAccount': 'Создать аккаунт',
    'auth.welcomeBack':   'С возвращением',
    'auth.signInSub':     'Войдите чтобы получить доступ к хранилищу',
    'auth.createSub':     'Получите 30 ГБ безопасного хранилища — бесплатно',
    'auth.username':         'Имя пользователя',
    'auth.usernameOrEmail':  'Логин или email',
    'auth.email':            'Email',
    'auth.password':         'Пароль',
    'auth.confirmPassword':  'Подтвердите пароль',
    'auth.signingIn':        'Вхожу…',
    'auth.creating':         'Создаю аккаунт…',
    'auth.noAccount':        'Нет аккаунта?',
    'auth.signUpFree':       'Зарегистрироваться',
    'auth.haveAccount':      'Уже зарегистрированы?',
    'auth.signInLink':       'Войти',
    // Storage
    'storage.root':           'Root',
    'storage.myStorage':      'Моё хранилище',
    'storage.navigation':     'Навигация',
    'storage.newFolder':      'Новая папка',
    'storage.upload':         'Загрузить',
    'storage.empty':          'Папка пуста',
    'storage.emptySub':       'Загрузите файлы или создайте новую папку',
    'storage.folder':         'Папка',
    'storage.signOut':        'Выйти',
    'storage.dropToUpload':   'Перетащите файлы для загрузки',
    'storage.uploading':      'Загрузка {n} {word}…',
    'storage.file':           'файл',
    'storage.files':          'файлов',
    'storage.settings':       'Настройки',
    'storage.downloadZip':    'Скачать как ZIP',
    'storage.preview':        'Просмотр',
    'storage.download':       'Скачать',
    'storage.delete':         'Удалить',
    'storage.cancel':         'Отмена',
    'storage.used':           'использовано',
    'storage.storageLabel':   'Хранилище',
    'storage.foldersLabel':   'папок',
    'storage.clickToPreview': 'нажмите для просмотра',
    'storage.justNow':        'только что',
    'storage.mAgo':           '{n} мин',
    'storage.hAgo':           '{n} ч',
    'storage.dAgo':           '{n} дн',
    'storage.rename':         'Переименовать',
    'storage.renameFile':     'Переименовать файл',
    'storage.renameFolder':   'Переименовать папку',
    'storage.create':         'Создать',
    'storage.creating':       'Создаю…',
    'storage.uploadFolder':   'Загрузить папку',
    'storage.folderNamePlaceholder': 'Имя папки',
    'storage.enterFolderName': 'Введите имя папки',
    'storage.noResults':      'Ничего не найдено',
    'storage.noResultsSub':   'Файлов и папок с именем "{q}" нет',
    // Settings
    'settings.title':        'Настройки',
    'settings.account':      'Аккаунт',
    'settings.appearance':   'Внешний вид',
    'settings.security':     'Безопасность',
    'settings.admin':        'Панель администратора',
    'settings.backToStorage':'← Вернуться к хранилищу',
    'settings.memberSince':  'Участник с',
    'settings.storageUsage': 'Использование хранилища',
    'settings.fileCount':    'Файлов',
    'settings.folderCount':  'Папок',
    // Account
    'settings.changeEmail':          'Изменить Email',
    'settings.newEmail':             'Новый email адрес',
    'settings.currentPassword':      'Текущий пароль',
    'settings.passwordForConfirm':   'Пароль для подтверждения',
    'settings.saveEmail':            'Обновить Email',
    // Security
    'settings.changePassword':       'Изменить пароль',
    'settings.oldPassword':          'Текущий пароль',
    'settings.newPassword':          'Новый пароль',
    'settings.confirmNewPassword':   'Подтвердите новый пароль',
    'settings.savePassword':         'Обновить пароль',
    'settings.deleteAccount':        'Удалить аккаунт',
    'settings.deleteAccountWarn':    'Это навсегда удалит аккаунт и ВСЕ файлы. Действие необратимо.',
    'settings.typePasswordToDelete': 'Введите пароль для подтверждения удаления',
    'settings.deleteAccountBtn':     'Безвозвратно удалить аккаунт',
    // Appearance
    'settings.language':        'Язык интерфейса',
    'settings.langEn':          'English',
    'settings.langRu':          'Русский',
    'settings.accentColor':     'Акцентный цвет',
    'settings.compactMode':     'Компактный режим',
    'settings.compactDesc':     'Уменьшить отступы в списке файлов',
    'settings.animationsOff':   'Уменьшить анимации',
    'settings.animationsDesc':  'Отключить необязательные анимации',
    // Admin
    'settings.adminUsers':      'Зарегистрированных пользователей',
    'settings.adminTotalFiles': 'Всего файлов',
    'settings.adminStorage':    'Суммарный объём',
    'settings.adminAnonFiles':  'Анонимных файлов',
    // Misc
    'misc.saved':  '✓ Сохранено',
    'misc.save':   'Сохранить изменения',
    'misc.saving': 'Сохраняю…',
    'misc.error':  'Ошибка',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectLang() {
  const saved = localStorage.getItem('tfp_lang')
  if (saved && T[saved]) return saved
  const browser = (navigator.language || 'en').slice(0, 2).toLowerCase()
  return T[browser] ? browser : 'en'
}

export const ACCENT_COLORS = [
  { name: 'green',  value: '#00d97e', bright: '#00ff96' },
  { name: 'blue',   value: '#00b4d8', bright: '#48cae4' },
  { name: 'purple', value: '#9d4edd', bright: '#c77dff' },
  { name: 'orange', value: '#ff6b35', bright: '#ff8c61' },
  { name: 'pink',   value: '#ff6b9d', bright: '#ff9ec4' },
]

export function applyAccent(colorName) {
  const color = ACCENT_COLORS.find(c => c.name === colorName) || ACCENT_COLORS[0]
  const root = document.documentElement.style
  root.setProperty('--green',       color.value)
  root.setProperty('--green-bright', color.bright)
  root.setProperty('--green-dim',   color.value + 'cc')
  root.setProperty('--green-dark',  color.value + '55')
  root.setProperty('--green-glow',  color.value + '40')
  root.setProperty('--green-glow2', color.value + '14')
  localStorage.setItem('tfp_accent', colorName)
}

// ── Context ───────────────────────────────────────────────────────────────────
const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(detectLang)

  // Apply saved accent color on mount
  useEffect(() => {
    const saved = localStorage.getItem('tfp_accent')
    if (saved) applyAccent(saved)
    // Apply compact/no-anim prefs
    if (localStorage.getItem('tfp_compact') === '1') document.documentElement.classList.add('compact')
    if (localStorage.getItem('tfp_no_anim') === '1') document.documentElement.classList.add('no-anim')
  }, [])

  const changeLang = (l) => {
    if (!T[l]) return
    localStorage.setItem('tfp_lang', l)
    setLangState(l)
  }

  // tr() — translate key with optional {var} substitution
  const tr = (key, vars = {}) => {
    const str = T[lang]?.[key] ?? T.en?.[key] ?? key
    return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''))
  }

  return (
    <LangContext.Provider value={{ lang, changeLang, tr }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
