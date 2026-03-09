import { createContext, useContext, useState } from 'react'

const UploadContext = createContext(null)

export function UploadProvider({ children }) {
  const [pendingFile, setPendingFile] = useState(null)
  return (
    <UploadContext.Provider value={{ pendingFile, setPendingFile }}>
      {children}
    </UploadContext.Provider>
  )
}

export function usePendingUpload() {
  return useContext(UploadContext)
}
