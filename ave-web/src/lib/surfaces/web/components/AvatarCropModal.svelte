<script lang="ts">
    import {
        DEFAULT_AVATAR_CROP,
        MAX_AVATAR_CROP_SCALE,
        MIN_AVATAR_CROP_SCALE,
        clampAvatarCrop,
        computeAvatarDrawParams,
        loadImageFromFile,
        renderCroppedSquareAvatar,
        canvasToJpegFile,
        scaleForZoomPercent,
        zoomPercentForScale,
        type AvatarCropState,
    } from "$lib/surfaces/web/lib/avatar-image";
    import { Image as ImageIcon, Minus, Plus, X } from "@lucide/svelte";

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

    const viewportMaxSize = 420;

    let image = $state<HTMLImageElement | null>(null);
    let crop = $state<AvatarCropState>({ ...DEFAULT_AVATAR_CROP });
    let measuredViewport = $state(viewportMaxSize);
    let dragging = $state(false);
    let zoomDragging = $state(false);
    let dragStart = $state({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
    let saving = $state(false);
    let loadError = $state<string | null>(null);
    let zoomTrack = $state<HTMLDivElement | null>(null);

    const zoomPercent = $derived(zoomPercentForScale(crop.scale));

    function portal(node: HTMLElement) {
        document.body.appendChild(node);
        return {
            destroy() {
                node.remove();
            },
        };
    }

    function setCrop(next: AvatarCropState) {
        crop = image ? clampAvatarCrop(image, measuredViewport, next) : next;
    }

    function drawParams() {
        if (!image) return null;
        return computeAvatarDrawParams(image, measuredViewport, crop);
    }

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

    $effect(() => {
        if (!open) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onCancel?.();
        };
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    });

    function startDrag(event: PointerEvent) {
        if (!image || zoomDragging) return;
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
        if (!dragging || !image) return;
        setCrop({
            ...crop,
            offsetX: dragStart.offsetX + (event.clientX - dragStart.x),
            offsetY: dragStart.offsetY + (event.clientY - dragStart.y),
        });
    }

    function endDrag(event: PointerEvent) {
        dragging = false;
        (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    }

    function adjustZoom(delta: number) {
        if (!image) return;
        setCrop({ ...crop, scale: crop.scale + delta });
    }

    function setZoomFromClientX(clientX: number) {
        if (!zoomTrack) return;
        const rect = zoomTrack.getBoundingClientRect();
        const percent = ((clientX - rect.left) / rect.width) * 100;
        setCrop({ ...crop, scale: scaleForZoomPercent(percent) });
    }

    function startZoomDrag(event: PointerEvent) {
        zoomDragging = true;
        setZoomFromClientX(event.clientX);
        window.addEventListener("pointermove", moveZoomDrag);
        window.addEventListener("pointerup", endZoomDrag);
        window.addEventListener("pointercancel", endZoomDrag);
    }

    function moveZoomDrag(event: PointerEvent) {
        if (!zoomDragging) return;
        setZoomFromClientX(event.clientX);
    }

    function endZoomDrag() {
        zoomDragging = false;
        window.removeEventListener("pointermove", moveZoomDrag);
        window.removeEventListener("pointerup", endZoomDrag);
        window.removeEventListener("pointercancel", endZoomDrag);
    }

    function handleWheel(event: WheelEvent) {
        if (!image) return;
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.08 : 0.08;
        adjustZoom(delta);
    }

    async function confirmCrop() {
        if (!image || !file || saving) return;
        saving = true;
        try {
            const canvas = renderCroppedSquareAvatar(image, crop, measuredViewport);
            const cropped = await canvasToJpegFile(canvas, file.name.replace(/\.\w+$/, "") + ".jpg");
            onConfirm?.(cropped);
        } finally {
            saving = false;
        }
    }
</script>

{#if open && file}
    <div use:portal>
        <div
            class="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Crop avatar"
            tabindex="-1"
            onclick={(event) => {
                if (event.target === event.currentTarget) onCancel?.();
            }}
            onkeydown={(event) => event.stopPropagation()}
        >
            <div
                class="w-full max-w-[560px] rounded-[28px] bg-[#171717] p-5 shadow-[0_32px_90px_rgba(0,0,0,0.55)] md:rounded-[36px] md:p-8"
                onclick={(event) => event.stopPropagation()}
                onkeydown={(event) => event.stopPropagation()}
                role="presentation"
            >
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <h2 class="m-0 text-[24px] font-black text-white md:text-[30px]">Crop avatar</h2>
                        <p class="m-0 mt-2 text-[14px] leading-6 text-[#878787] md:text-[16px]">
                            Drag to reposition, scroll or use the zoom control. Your avatar is always saved as a square.
                        </p>
                    </div>
                    <button
                        type="button"
                        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111111] text-[#B9BBBE] transition-colors hover:bg-[#222222] hover:text-white"
                        aria-label="Close"
                        onclick={() => onCancel?.()}
                    >
                        <X size={20} strokeWidth={2.25} />
                    </button>
                </div>

                <div class="mt-6 md:mt-8">
                    {#if loadError}
                        <div class="rounded-[18px] bg-[#E14747]/15 px-4 py-3">
                            <p class="m-0 text-[14px] text-[#E14747] md:text-[15px]">{loadError}</p>
                        </div>
                    {:else if image}
                        {@const params = drawParams()}
                        <div
                            bind:clientWidth={measuredViewport}
                            class="relative mx-auto overflow-hidden rounded-[24px] bg-[#090909] touch-none select-none ring-1 ring-white/10"
                            style="width: min(100%, {viewportMaxSize}px); aspect-ratio: 1 / 1;"
                            role="application"
                            aria-label="Avatar crop area"
                            onpointerdown={startDrag}
                            onpointermove={moveDrag}
                            onpointerup={endDrag}
                            onpointercancel={endDrag}
                            onwheel={handleWheel}
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

                            <div class="pointer-events-none absolute inset-0">
                                <div class="absolute inset-0 grid grid-cols-3 grid-rows-3">
                                    {#each Array(9) as _, index}
                                        <div class="border-white/20 {index % 3 !== 2 ? 'border-r' : ''} {index < 6 ? 'border-b' : ''}"></div>
                                    {/each}
                                </div>
                                <div class="absolute inset-3 rounded-[18px] ring-1 ring-white/35"></div>
                                <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_58%,rgba(0,0,0,0.42)_100%)]"></div>
                            </div>
                        </div>

                        <div class="mt-5 flex items-center gap-3">
                            <button
                                type="button"
                                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white transition-colors hover:bg-[#222222] disabled:opacity-40"
                                aria-label="Zoom out"
                                disabled={crop.scale <= MIN_AVATAR_CROP_SCALE}
                                onclick={() => adjustZoom(-0.12)}
                            >
                                <Minus size={18} strokeWidth={2.5} />
                            </button>

                            <div
                                bind:this={zoomTrack}
                                class="relative h-2 flex-1 rounded-full bg-[#111111]"
                                onpointerdown={startZoomDrag}
                                role="slider"
                                aria-label="Zoom"
                                aria-valuemin={MIN_AVATAR_CROP_SCALE}
                                aria-valuemax={MAX_AVATAR_CROP_SCALE}
                                aria-valuenow={crop.scale}
                                tabindex="0"
                                onkeydown={(event) => {
                                    if (event.key === "ArrowLeft") adjustZoom(-0.08);
                                    if (event.key === "ArrowRight") adjustZoom(0.08);
                                }}
                            >
                                <div
                                    class="absolute left-0 top-0 h-full rounded-full bg-[#B9BBBE]"
                                    style="width: {zoomPercent}%"
                                ></div>
                                <div
                                    class="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_10px_rgba(0,0,0,0.35)]"
                                    style="left: calc({zoomPercent}% - 10px)"
                                ></div>
                            </div>

                            <button
                                type="button"
                                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white transition-colors hover:bg-[#222222] disabled:opacity-40"
                                aria-label="Zoom in"
                                disabled={crop.scale >= MAX_AVATAR_CROP_SCALE}
                                onclick={() => adjustZoom(0.12)}
                            >
                                <Plus size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                    {:else}
                        <div class="mx-auto aspect-square w-full max-w-[420px] rounded-[24px] bg-[#111111] animate-pulse"></div>
                    {/if}
                </div>

                <div class="mt-6 flex flex-col gap-2 md:mt-8 md:flex-row">
                    <button
                        type="button"
                        class="flex-1 rounded-full bg-[#222222] px-5 py-3.5 text-[15px] font-semibold text-[#D3D3D3] transition-colors hover:bg-[#2b2b2b] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]"
                        onclick={() => onCancel?.()}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="flex flex-1 items-center justify-center gap-3 rounded-full bg-[#B9BBBE] px-5 py-3.5 text-[15px] font-black text-[#090909] transition-colors hover:bg-[#A1A1A1] disabled:cursor-not-allowed disabled:opacity-50 md:text-[16px]"
                        onclick={confirmCrop}
                        disabled={!image || saving}
                    >
                        {#if saving}
                            <span class="h-4 w-4 rounded-full border-2 border-[#090909] border-t-transparent animate-spin"></span>
                        {:else}
                            <ImageIcon size={18} strokeWidth={2.25} />
                        {/if}
                        {saving ? "Saving..." : "Use photo"}
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}
