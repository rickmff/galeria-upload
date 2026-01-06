import { useState, useEffect, useRef } from 'react'

function App() {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedImageIds, setSelectedImageIds] = useState([])
  const [viewMode, setViewMode] = useState('grid')
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [toast, setToast] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [confirmModal, setConfirmModal] = useState(null)

  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)
  const uploadFilesRef = useRef(null)
  const setDragActiveRef = useRef(null)

  useEffect(() => {
    loadImages()
  }, [])

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark-mode')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark-mode')
    }
  }, [darkMode])

  useEffect(() => {
    uploadFilesRef.current = uploadFiles
    setDragActiveRef.current = setDragActive
  })

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && confirmModal) {
        confirmModal.onCancel()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [confirmModal])

  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (setDragActiveRef.current) {
        setDragActiveRef.current(true)
      }
    }

    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDragLeave = (e) => {
      if (!e.relatedTarget || e.relatedTarget === document.body) {
        if (setDragActiveRef.current) {
          setDragActiveRef.current(false)
        }
      }
    }

    const handleDropGlobal = async (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        if (setDragActiveRef.current) {
          setDragActiveRef.current(false)
        }
        if (uploadFilesRef.current) {
          await uploadFilesRef.current(e.dataTransfer.files)
        }
      } else {
        if (setDragActiveRef.current) {
          setDragActiveRef.current(false)
        }
      }
    }

    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('drop', handleDropGlobal)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('drop', handleDropGlobal)
    }
  }, [])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadImages = async () => {
    try {
      const response = await fetch('/api/images')
      const data = await response.json()
      if (data.success) {
        setImages(data.images)
      }
    } catch (error) {
      console.error('Erro ao carregar imagens:', error)
      showToast('Erro ao carregar imagens', 'error')
    }
  }

  const uploadFiles = async (files) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      showToast('Por favor, selecione apenas imagens', 'error')
      return
    }

    setLoading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      imageFiles.forEach(file => {
        formData.append('images', file)
      })

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 100)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const data = await response.json()

      if (data.success) {
        setImages(prev => [...data.images, ...prev])
        showToast(`${data.images.length} imagem(ns) enviada(s) com sucesso!`, 'success')
      } else {
        showToast('Erro ao fazer upload: ' + data.error, 'error')
      }
    } catch (error) {
      console.error('Erro no upload:', error)
      showToast('Erro ao fazer upload das imagens', 'error')
    } finally {
      setLoading(false)
      setTimeout(() => setUploadProgress(0), 500)
    }
  }

  const handleFileChange = async (e) => {
    await uploadFiles(e.target.files)
    e.target.value = ''
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files)
    }
  }

  const removeImage = async (id, e) => {
    e.stopPropagation()

    setConfirmModal({
      message: 'Tem certeza que deseja deletar esta imagem?',
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/images/${id}`, {
            method: 'DELETE'
          })

          const data = await response.json()

          if (data.success) {
            setImages(prev => prev.filter(img => img.id !== id))
            showToast('Imagem deletada com sucesso', 'success')
            if (selectedImage?.id === id) {
              setSelectedImage(null)
            }
            setSelectedImageIds(prev => prev.filter(imgId => imgId !== id))
          } else {
            showToast('Erro ao deletar imagem: ' + data.error, 'error')
          }
        } catch (error) {
          console.error('Erro ao deletar:', error)
          showToast('Erro ao deletar imagem', 'error')
        }
        setConfirmModal(null)
      },
      onCancel: () => {
        setConfirmModal(null)
      }
    })
  }

  const startRename = (image, e) => {
    e.stopPropagation()
    setRenamingId(image.id)
    const nameWithoutExt = image.originalname.replace(/\.[^/.]+$/, '')
    setRenameValue(nameWithoutExt)
  }

  const saveRename = async (id) => {
    try {
      const response = await fetch(`/api/images/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: renameValue })
      })

      const data = await response.json()

      if (data.success) {
        setImages(prev => prev.map(img =>
          img.id === id ? { ...img, originalname: data.originalname } : img
        ))
        showToast('Imagem renomeada com sucesso', 'success')
        setRenamingId(null)
        setRenameValue('')
      } else {
        showToast('Erro ao renomear: ' + data.error, 'error')
      }
    } catch (error) {
      console.error('Erro ao renomear:', error)
      showToast('Erro ao renomear imagem', 'error')
    }
  }

  const cancelRename = () => {
    setRenamingId(null)
    setRenameValue('')
  }

  const toggleImageSelection = (imageId, e) => {
    e.stopPropagation()
    setSelectedImageIds(prev => {
      if (prev.includes(imageId)) {
        return prev.filter(id => id !== imageId)
      } else {
        return [...prev, imageId]
      }
    })
  }

  const handleImageDoubleClick = (image) => {
    setSelectedImage(image)
  }

  const downloadSelectedImages = async () => {
    if (selectedImageIds.length === 0) return

    try {
      for (const imageId of selectedImageIds) {
        const image = images.find(img => img.id === imageId)
        if (image) {
          const response = await fetch(image.url)
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = image.originalname
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }
      }
      showToast(`${selectedImageIds.length} imagem(ns) baixada(s) com sucesso!`, 'success')
      setSelectedImageIds([])
    } catch (error) {
      console.error('Erro ao baixar imagens:', error)
      showToast('Erro ao baixar imagens', 'error')
    }
  }

  const filteredImages = images.filter(img =>
    img.originalname.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors">
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-foreground">Galeria</h1>
          <div className="flex gap-2 items-center">
            <button
              className="w-8 h-8 p-0 rounded-md bg-transparent border-none cursor-pointer flex items-center justify-center text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="Alternar tema"
              title={darkMode ? 'Modo claro' : 'Modo escuro'}
            >
              {darkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>
            <div className="flex gap-1 bg-muted p-1 rounded-md">
              <button
                className={`w-8 h-8 p-0 rounded-md border-none cursor-pointer flex items-center justify-center transition-all ${viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                onClick={() => setViewMode('grid')}
                aria-label="Visualização em grade"
                aria-pressed={viewMode === 'grid'}
                title="Visualização em grade"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={viewMode === 'grid' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
              </button>
              <button
                className={`w-8 h-8 p-0 rounded-md border-none cursor-pointer flex items-center justify-center transition-all ${viewMode === 'list'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}
                onClick={() => setViewMode('list')}
                aria-label="Visualização em linha"
                aria-pressed={viewMode === 'list'}
                title="Visualização em linha"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={viewMode === 'list' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"></line>
                  <line x1="8" y1="12" x2="21" y2="12"></line>
                  <line x1="8" y1="18" x2="21" y2="18"></line>
                  <line x1="3" y1="6" x2="3.01" y2="6"></line>
                  <line x1="3" y1="12" x2="3.01" y2="12"></line>
                  <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {loading && (
        <div className="fixed top-0 left-0 right-0 w-full h-1 bg-muted rounded-none overflow-hidden z-[101]">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      <div
        className={`fixed inset-0 z-[100] border-none bg-transparent pointer-events-none transition-all flex items-center justify-center ${dragActive ? 'bg-accent/10 pointer-events-auto border-[3px] border-dashed border-primary backdrop-blur-sm' : ''}`}
        ref={dropZoneRef}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      />

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex gap-4 items-center mb-6">
          <div className="flex-1 flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar imagens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm transition-all focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            {searchTerm && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {filteredImages.length} de {images.length}
              </span>
            )}
            {selectedImageIds.length > 0 && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {selectedImageIds.length} selecionada(s)
              </span>
            )}
          </div>
          {selectedImageIds.length > 0 && (
            <button
              onClick={downloadSelectedImages}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border-none inline-flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Download ({selectedImageIds.length})
            </button>
          )}
          <label htmlFor="file-input" className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border-none inline-flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90">
            {loading ? 'Enviando...' : 'Upload'}
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id="file-input"
            multiple
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {filteredImages.length > 0 ? (
          <div className={`${viewMode === 'grid' ? 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]' : 'flex flex-col gap-2'}`}>
            {filteredImages.map(image => {
              const isSelected = selectedImageIds.includes(image.id)
              return (
                <div
                  key={image.id}
                  className={`bg-card border rounded-lg overflow-hidden cursor-pointer transition-all hover:border-ring hover:shadow-lg ${isSelected ? 'border-primary ring-2 ring-primary' : 'border-border'} ${viewMode === 'list' ? 'flex flex-row items-center p-2 gap-3' : ''}`}
                  onClick={(e) => toggleImageSelection(image.id, e)}
                  onDoubleClick={() => handleImageDoubleClick(image)}
                >
                  <div className={`relative overflow-hidden bg-muted ${viewMode === 'list' ? 'w-20 h-[60px] flex-shrink-0 rounded-md' : 'w-full aspect-square'}`}>
                    <img
                      src={image.url}
                      alt={image.originalname}
                      loading="lazy"
                      className={`w-full h-full object-cover transition-transform ${viewMode === 'list' ? 'rounded-md' : ''} ${viewMode === 'grid' ? 'hover:scale-105' : ''}`}
                    />
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold z-10">
                        ✓
                      </div>
                    )}
                    {viewMode === 'grid' && (
                      <div className="absolute inset-0 opacity-0 transition-opacity hover:opacity-100 pointer-events-none group">
                        <button
                          onClick={(e) => removeImage(image.id, e)}
                          className="absolute top-2 right-2 w-8 h-8 p-0 rounded-md bg-foreground/80 backdrop-blur-sm border-none cursor-pointer flex items-center justify-center text-destructive transition-all hover:bg-destructive/20 pointer-events-auto"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                  <div className={`${viewMode === 'list' ? 'flex-1 p-0 min-w-0 flex flex-col gap-1' : 'p-3'}`}>
                    {renamingId === image.id ? (
                      <div className="flex gap-1 items-center flex-wrap">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(image.id)
                            if (e.key === 'Escape') cancelRename()
                          }}
                          className={`border border-input rounded-lg bg-background text-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 ${viewMode === 'list' ? 'px-2 py-1 text-[0.6875rem]' : 'px-2 py-1.5 text-xs'}`}
                          autoFocus
                        />
                        <button
                          onClick={() => saveRename(image.id)}
                          className="w-8 h-8 p-0 rounded-md bg-transparent border-none cursor-pointer flex items-center justify-center text-primary transition-all hover:bg-accent hover:text-accent-foreground"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelRename}
                          className="w-8 h-8 p-0 rounded-md bg-transparent border-none cursor-pointer flex items-center justify-center text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className={`flex items-center justify-between gap-2 w-full ${viewMode === 'list' ? '' : ''}`}>
                          <p
                            className={`font-medium overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer transition-colors hover:text-primary ${viewMode === 'list' ? 'flex-1 min-w-0 text-xs mb-0' : 'text-sm mb-1'}`}
                            title={image.originalname}
                            onClick={(e) => {
                              e.stopPropagation()
                              startRename(image, e)
                            }}
                          >
                            {viewMode === 'list'
                              ? image.originalname
                              : image.originalname.length > 25
                                ? image.originalname.substring(0, 25) + '...'
                                : image.originalname}
                          </p>
                          {viewMode === 'list' && (
                            <button
                              onClick={(e) => removeImage(image.id, e)}
                              className="w-8 h-8 p-0 rounded-md bg-transparent border-none cursor-pointer flex items-center justify-center text-destructive transition-all hover:bg-destructive/10 flex-shrink-0 opacity-70 hover:opacity-100"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                        <div className={`flex gap-2 text-xs text-muted-foreground flex-wrap ${viewMode === 'list' ? 'text-[0.6875rem] gap-1.5' : ''}`}>
                          <span>{formatFileSize(image.size)}</span>
                          <span>•</span>
                          <span>{formatDate(image.created_at)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16 px-8 text-muted-foreground">
            {loading ? (
              <>
                <div className="w-full max-w-md h-72 mx-auto mb-4 bg-muted rounded-lg animate-pulse"></div>
                <p>Carregando...</p>
              </>
            ) : searchTerm ? (
              <>
                <p>Nenhuma imagem encontrada para "{searchTerm}"</p>
              </>
            ) : (
              <>
                <p>Nenhuma imagem salva ainda</p>
                <p className="text-sm mt-2">Faça upload de imagens para começar</p>
              </>
            )}
          </div>
        )}
      </main>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-foreground/80 flex items-center justify-center z-[1000] p-8 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-[90vw] max-h-[90vh] relative bg-card rounded-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute top-4 right-4 z-[1001] w-8 h-8 p-0 rounded-md bg-foreground/80 text-background flex items-center justify-center transition-all hover:bg-foreground/90"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
            <img
              src={selectedImage.url}
              alt={selectedImage.originalname}
              className="w-full h-auto max-h-[70vh] object-contain block"
            />
            <div className="p-4">
              <h3 className="text-base font-semibold mb-2">{selectedImage.originalname}</h3>
              <div className="flex gap-4 flex-wrap text-sm text-muted-foreground">
                <span>Tamanho: {formatFileSize(selectedImage.size)}</span>
                <span>Tipo: {selectedImage.mimetype}</span>
                <span>Data: {formatDate(selectedImage.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 left-4 md:left-auto px-4 py-3 rounded-lg bg-card border border-border shadow-lg z-[2000] text-sm animate-[slideUp_0.2s] ${toast.type === 'success' ? 'border-primary' : 'border-destructive'}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}

      {confirmModal && (
        <div
          className="fixed inset-0 bg-foreground/50 flex items-center justify-center z-[2000] backdrop-blur-sm animate-[fadeIn_0.2s]"
          onClick={confirmModal.onCancel}
        >
          <div className="bg-card rounded-lg p-6 max-w-md w-[90%] shadow-2xl animate-[slideDown_0.2s]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-3 text-foreground">Confirmar ação</h3>
            <p className="text-muted-foreground mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border-none inline-flex items-center justify-center bg-secondary text-secondary-foreground hover:bg-secondary/80"
                onClick={confirmModal.onCancel}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all border-none inline-flex items-center justify-center bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={confirmModal.onConfirm}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
