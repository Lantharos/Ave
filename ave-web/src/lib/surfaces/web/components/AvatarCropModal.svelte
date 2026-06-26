<script lang="ts">
    import {
        DEFAULT_AVATAR_CROP,
        computeAvatarDrawParams,
        loadImageFromFile,
        renderCroppedSquareAvatar,
        canvasToJpegFile,
        type AvatarCropState,
    } from "$lib/surfaces/web/lib/avatar-image";

    let {
        file,
        open = false,
        onCancel,
        onConfirm,
    } = $props<{
        file: File | null;
        open?: boolean;
        onCancel?: () => void;
        onConfirm?: (croppedFile: File) => void;
    }>();

    const viewportSize = 320;

    let image = $state<HTMLImageElement | null>(null);
    let crop = $state<AvatarCropState>({ ...DEFAULT_AVATAR_CROP });
    let dragging = $state(false);
    let dragStart = $state({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
    let saving = $state(false);
    let loadError = $state<string | null>(null);

    $effect(() => {
        if (!open || !file) {
            image = null;
            crop = { ...DEFAULT_AVATAR_CROP };
            loadError = null;
            return;
        }

        let cancelled = false;
        loadError = null;
        crop = { ...DEFAULT_AVATAR_CROP };

        void loadImageFromFile(file)
            .then((loaded) => {
                if (!cancelled) image = loaded;
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    loadError = error instanceof Error ? error.message : "Could not load image";
                    image = null;
                }
            });

        return () => {
            cancelled = true;
        };
    });

    function drawParams() {
        if (!image) return null;
        return computeAvatarDrawParams(image, viewportSize, crop);
    }

    function startDrag(event: PointerEvent) {
        if (!image) return;
        dragging = true;
        dragStart = {
            x: event.clientX,
            y: event.clientY,
            offsetX: crop.offsetX,
            offsetY: crop.offsetY,
        };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    function moveDrag(event: PointerEvent) {
        if (!dragging) return;
        crop = {
            ...crop,
            offsetX: dragStart.offsetX + (event.clientX - dragStart.x),
            offsetY: dragStart.offsetY + (event.clientY - dragStart.y),
        };
    }

    function endDrag(event: PointerEvent) {
        dragging = false;
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    }

    async function confirmCrop() {
        if (!image || !file || saving) return;
        saving = true;
        try {
            const canvas = renderCroppedSquareAvatar(image, crop, viewportSize);
            const cropped = await canvasToJpegFile(canvas, file.name.replace(/\.\w+$/, "") + ".jpg");
            onConfirm?.(cropped);
        } finally {
            saving = false;
        }
    }
</script>

{#if open && file}
    <div
        class="fixed inset-0 z-[10000] flex items-center justify-center bg-[#090909]/90 p-4"
        role="presentation"
        onclick={(event) => {
            if (event.target === event.currentTarget) onCancel?.();
        }}
    >
        <div class="w-full max-w-[420px] rounded-[24px] bg-[#171717] p-5 md:p-6 flex flex-col gap-5">
            <div class="flex flex-col gap-1">
                <h2 class="text-white text-xl font-semibold font-poppins">Crop avatar</h2>
                <p class="text-[#878787] text-sm font-poppins">Drag to reposition. Your avatar is always saved as a square.</p>
            </div>

            {#if loadError}
                <p class="text-[#E14747] text-sm">{loadError}</p>
            {:else if image}
                {@const params = drawParams()}
                <div
                    class="relative mx-auto overflow-hidden rounded-[20px] bg-[#111111] touch-none select-none"
                    style="width: {viewportSize}px; height: {viewportSize}px;"
                    role="application"
                    aria-label="Avatar crop area"
                    onpointerdown={startDrag}
                    onpointermove={moveDrag}
                    onpointerup={endDrag}
                    onpointercancel={endDrag}
                >
                    <img
                        src={image.src}
                        alt=""
                        class="absolute max-w-none pointer-events-none"
                        style={params
                            ? `left: ${params.x}px; top: ${params.y}px; width: ${params.drawWidth}px; height: ${params.drawHeight}px;`
                            : "opacity: 0;"}
                        draggable="false"
                    />
                    <div class="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10"></div>
                </div>

                <label class="flex flex-col gap-2">
                    <span class="text-[#878787] text-xs font-poppins">Zoom</span>
                    <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.01"
                        bind:value={crop.scale}
                        class="w-full accent-white"
                    />
                </label>
            {:else}
                <div class="mx-auto h-[320px] w-[320px] rounded-[20px] bg-[#111111] animate-pulse"></div>
            {/if}

            <div class="flex flex-row gap-3 justify-end">
                <button
                    type="button"
                    class="px-5 py-3 rounded-full bg-[#222222] text-white hover:bg-[#2a2a2a] transition-colors"
                    onclick={() => onCancel?.()}
                    disabled={saving}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="px-5 py-3 rounded-full bg-white text-[#090909] font-semibold hover:bg-[#e8e8e8] transition-colors disabled:opacity-60"
                    onclick={confirmCrop}
                    disabled={!image || saving}
                >
                    {saving ? "Saving..." : "Use photo"}
                </button>
            </div>
        </div>
    </div>
{/if}
