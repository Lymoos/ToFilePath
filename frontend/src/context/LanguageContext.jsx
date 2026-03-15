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
    'auth.createHeading':    'Create your account',
    'auth.usernamePlaceholder':        'choose a username',
    'auth.usernameOrEmailPlaceholder': 'username or email',
    'auth.passwordPlaceholder':        'at least 6 characters',
    'auth.passwordsNoMatch':  'Passwords do not match',
    'auth.passwordTooShort':  'Password must be at least 6 characters',
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
    'storage.uploadErrFailed':  'Upload failed — please try again',
    'storage.uploadErrConn':    'Connection lost during upload',
    'storage.uploadErrTooLarge':'File exceeds your remaining storage quota',
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
    // Home – hero
    'home.badge':          'Up to 3 GB\u00b7 No account needed \u00b7 Up to 5 GB with account',
    'home.heroLine':       'Drop it. Share it.',
    'home.word0':          'Securely.',
    'home.word1':          'Privately.',
    'home.word2':          'Instantly.',
    'home.word3':          'Ephemerally.',
    'home.heroSub1':       'Upload any file up to',
    'home.heroSub2':       'and get a short link instantly.',
    'home.createFreeAccount': 'Create a free account',
    'home.heroSub3':       'for up to 5\u00a0GB of personal storage.',
    // Home – drop zone
    'home.readyToUpload':  'Ready to upload',
    'home.dragDrop':       'Drag\u00a0& drop your file here',
    'home.orClickBrowse':  'or click to browse \u2014 up to 3 GB',
    'home.fileTypes':      'Archives, videos, images, documents \u2014 anything goes',
    // Home – need account
    'home.fileExceeds':    'File exceeds 3 GB',
    'home.anonLimitText':  'Anonymous uploads are limited to 3\u00a0GB. Create a free account to upload up to 5\u00a0GB.',
    'home.createAccount':  'Create Account',
    // Home – options
    'home.advancedOptions':    'Advanced options',
    'home.expiresAfter':       'Expires after',
    'home.downloadLimit':      'Download limit',
    'home.passwordOpt':        'Password protection (optional)',
    'home.passwordPlaceholder':'Leave blank for no password',
    'home.expiry1h':  '1 hour',   'home.expiry12h': '12 hours',
    'home.expiry1d':  '1 day',    'home.expiry3d':  '3 days',
    'home.expiry7d':  '7 days',   'home.expiry30d': '30 days',
    'home.dlUnlimited': 'Unlimited',
    'home.dl1':  '1 download',   'home.dl5':  '5 downloads',
    'home.dl10': '10 downloads', 'home.dl25': '25 downloads', 'home.dl50': '50 downloads',
    // Home – upload button + progress
    'home.uploadBtn':     'Upload\u00a0& Generate Link',
    'home.uploading':     'Uploading\u2026',
    'home.uploadFailed':  'Upload failed — please try again',
    'home.uploadConnErr': 'Connection lost during upload — please try again',
    'home.fileTooLarge':  'File exceeds the 3\u00a0GB limit',
    'home.speedLabel': 'Speed:',
    'home.etaLabel':   'ETA:',
    // Home – success card
    'home.fileUploaded':     'File uploaded!',
    'home.copied':           'Copied!',
    'home.copy':             'Copy',
    'home.expiresChip':      'Expires {date}',
    'home.maxDownloadsChip': 'Max {n} downloads',
    'home.passwordChip':     'Password protected',
    'home.scanToDownload':   'Scan to download',
    'home.uploadAnother':    '\u2191 Upload another file',
    // Home – features section
    'home.whyLabel': 'Why ToFilePath',
    'home.whyTitle': "Everything you need, nothing you don\u2019t",
    'home.whySub':   'No accounts, no tracking, no nonsense.',
    'home.feat0.title': 'Instant uploads',
    'home.feat0.desc':  'Upload any file up to 3 GB and get a shareable link in seconds. No sign-up.',
    'home.feat1.title': 'Self-destructing links',
    'home.feat1.desc':  'Set expiry from 1 hour to 30 days. Files vanish automatically.',
    'home.feat2.title': 'Password protection',
    'home.feat2.desc':  'Lock your file so only the recipient with the password can download it.',
    'home.feat3.title': 'Download limits',
    'home.feat3.desc':  'Cap at 1, 5, 10, 25 or 50 downloads. Link goes dark after the limit.',
    'home.feat4.title': 'QR code sharing',
    'home.feat4.desc':  'Every upload generates a QR code \u2014 instantly share from desktop to phone.',
    'home.feat5.title': 'Zero tracking',
    'home.feat5.desc':  'No cookies, no analytics, no accounts. Your files, your business.',
    // Home – stats section
    'home.statsFiles':     'Files shared',
    'home.statsData':      'Data transferred',
    'home.statsDownloads': 'Downloads served',
    'home.statsStorage':   'Account storage',
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
    'auth.signInSub':     'Войдите, чтобы получить доступ к хранилищу',
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
    'auth.createHeading':    'Создайте аккаунт',
    'auth.usernamePlaceholder':        'придумайте имя пользователя',
    'auth.usernameOrEmailPlaceholder': 'логин или email',
    'auth.passwordPlaceholder':        'не менее 6 символов',
    'auth.passwordsNoMatch':  'Пароли не совпадают',
    'auth.passwordTooShort':  'Пароль должен быть не менее 6 символов',
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
    'storage.uploadErrFailed':  'Ошибка загрузки — попробуйте ещё раз',
    'storage.uploadErrConn':    'Соединение прервано при загрузке',
    'storage.uploadErrTooLarge':'Файл превышает доступное место',
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
    // Home – hero
    'home.badge':          'До 3 ГБ \u00b7 Без регистрации \u00b7 До 5 ГБ с аккаунтом',
    'home.heroLine':       'Загрузи. Поделись.',
    'home.word0':          'Безопасно.',
    'home.word1':          'Приватно.',
    'home.word2':          'Мгновенно.',
    'home.word3':          'Эфемерно.',
    'home.heroSub1':       'Загрузите любой файл до',
    'home.heroSub2':       'и получите короткую ссылку мгновенно.',
    'home.createFreeAccount': 'Создайте бесплатный аккаунт',
    'home.heroSub3':       'и получите до 5\u00a0ГБ личного хранилища.',
    // Home – drop zone
    'home.readyToUpload':  'Готово к загрузке',
    'home.dragDrop':       'Перетащите файл сюда',
    'home.orClickBrowse':  'или нажмите для выбора \u2014 до 3 ГБ',
    'home.fileTypes':      'Архивы, видео, изображения, документы \u2014 всё что угодно',
    // Home – need account
    'home.fileExceeds':    'Файл больше 3 ГБ',
    'home.anonLimitText':  'Анонимная загрузка ограничена 3\u00a0ГБ. Создайте аккаунт для загрузки до 5\u00a0ГБ.',
    'home.createAccount':  'Создать аккаунт',
    // Home – options
    'home.advancedOptions':    'Дополнительные параметры',
    'home.expiresAfter':       'Истекает через',
    'home.downloadLimit':      'Лимит скачиваний',
    'home.passwordOpt':        'Защита паролем (необязательно)',
    'home.passwordPlaceholder':'Оставьте пустым для доступа без пароля',
    'home.expiry1h':  '1 час',    'home.expiry12h': '12 часов',
    'home.expiry1d':  '1 день',   'home.expiry3d':  '3 дня',
    'home.expiry7d':  '7 дней',   'home.expiry30d': '30 дней',
    'home.dlUnlimited': 'Без ограничений',
    'home.dl1':  '1 скачивание',   'home.dl5':  '5 скачиваний',
    'home.dl10': '10 скачиваний', 'home.dl25': '25 скачиваний', 'home.dl50': '50 скачиваний',
    // Home – upload button + progress
    'home.uploadBtn':     'Загрузить\u00a0и создать ссылку',
    'home.uploading':     'Загружаю\u2026',
    'home.uploadFailed':  'Ошибка загрузки — попробуйте ещё раз',
    'home.uploadConnErr': 'Соединение прервано — попробуйте ещё раз',
    'home.fileTooLarge':  'Файл превышает лимит 3\u00a0ГБ',
    'home.speedLabel': 'Скорость:',
    'home.etaLabel':   'Осталось:',
    // Home – success card
    'home.fileUploaded':     'Файл загружен!',
    'home.copied':           'Скопировано!',
    'home.copy':             'Копировать',
    'home.expiresChip':      'Истекает {date}',
    'home.maxDownloadsChip': 'Макс.\u00a0{n} скачиваний',
    'home.passwordChip':     'Защищён паролем',
    'home.scanToDownload':   'Отсканируйте для скачивания',
    'home.uploadAnother':    '\u2191 Загрузить ещё один файл',
    // Home – features section
    'home.whyLabel': 'Почему ToFilePath',
    'home.whyTitle': 'Всё что нужно, ничего лишнего',
    'home.whySub':   'Без аккаунтов, слежки и лишних сложностей.',
    'home.feat0.title': 'Мгновенная загрузка',
    'home.feat0.desc':  'Загрузите любой файл до 3 ГБ и получите ссылку за секунды. Без регистрации.',
    'home.feat1.title': 'Самоуничтожающиеся ссылки',
    'home.feat1.desc':  'Срок действия от 1 часа до 30 дней. Файлы исчезают автоматически.',
    'home.feat2.title': 'Защита паролем',
    'home.feat2.desc':  'Заблокируйте файл — скачать сможет только получатель с паролем.',
    'home.feat3.title': 'Лимит скачиваний',
    'home.feat3.desc':  'Ограничьте 1, 5, 10, 25 или 50 скачиваниями. Ссылка гаснет после лимита.',
    'home.feat4.title': 'QR-код для обмена',
    'home.feat4.desc':  'Каждая загрузка генерирует QR-код — мгновенно делитесь с телефона.',
    'home.feat5.title': 'Никакой слежки',
    'home.feat5.desc':  'Без куки, аналитики и аккаунтов. Ваши файлы — ваше дело.',
    // Home – stats section
    'home.statsFiles':     'Файлов опубликовано',
    'home.statsData':      'Данных передано',
    'home.statsDownloads': 'Скачиваний обслужено',
    'home.statsStorage':   'Хранилище аккаунта',
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
