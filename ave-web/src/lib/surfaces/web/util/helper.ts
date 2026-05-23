export function preloadImages(urls: string[]): Promise<void> {
    return Promise.all(
        urls.map(
            (src) =>
                new Promise<void>((resolve) => {
                    const img = new Image();
                    img.decoding = 'async';   // avoids main-thread jank
                    (img as any).loading = 'eager'; // hint; harmless elsewhere
                    img.src = src;
                    img.onload = img.onerror = () => resolve();
                })
        )
    ).then(() => {});
}