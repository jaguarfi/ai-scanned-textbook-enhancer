const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  // Update card settings
  const handleUpdateSettings = (id: string, settings: EnhancedImageItem['settings']) => {
    setImages((prev) =>
      prev.map((item) => (item.id === id ? { ...item, settings } : item))
    );
  };`;

const replacement = `  // Update card settings with debounced live preview
  const livePreviewTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  const handleUpdateSettings = (id: string, settings: EnhancedImageItem['settings']) => {
    setImages((prev) => {
      const currentImg = prev.find(i => i.id === id);
      if (currentImg && currentImg.status === 'enhanced') {
        if (livePreviewTimeoutRef.current[id]) {
          clearTimeout(livePreviewTimeoutRef.current[id]);
        }
        livePreviewTimeoutRef.current[id] = setTimeout(async () => {
          try {
            // Re-run processing silently for live preview
            const result = await enhanceImageLocally(currentImg.originalUrl, settings);
            setImages(p => p.map(i => i.id === id ? {
              ...i,
              enhancedUrl: result.enhancedUrl,
              vectorSvgUrl: result.vectorSvgUrl,
              enhancedWidth: result.width,
              enhancedHeight: result.height,
              enhancedSize: result.size,
              aiMetrics: { ...i.aiMetrics, ...result.aiMetrics }
            } : i));
          } catch (e) {
            console.error('Live preview processing failed', e);
          }
        }, 300); // 300ms debounce
      }
      return prev.map((item) => (item.id === id ? { ...item, settings } : item));
    });
  };`;

code = code.replace(target, replacement);
fs.writeFileSync('src/App.tsx', code);
