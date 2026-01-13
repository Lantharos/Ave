<script lang="ts">
    export let type: 'h' | 'hd' | 'p' = 'p';
    export let weight: 'normal' | 'medium' | 'semibold' | 'bold' | 'black' = 'normal';
    export let size: number = type === 'h' ? 40 : type === 'hd' ? 18 : 24;
    export let mobileSize: number | undefined = undefined;
    export let color: string = type === 'p' ? '#878787' : '#D3D3D3';
    export let cclass: string = '';

    $: weightClass =
        weight === 'normal' ? 'font-normal' :
            weight === 'medium' ? 'font-medium' :
                weight === 'bold' ? 'font-extrabold' :
                    weight === 'semibold' ? 'font-semibold' :
                        'font-black';
    
    $: mobileStyle = mobileSize ? `--mobile-size: ${mobileSize}px; --desktop-size: ${size}px;` : `--mobile-size: ${size}px; --desktop-size: ${size}px;`;
</script>

<style>
    .responsive-text {
        font-size: var(--mobile-size);
    }
    @media (min-width: 768px) {
        .responsive-text {
            font-size: var(--desktop-size);
        }
    }
</style>

{#if type === 'h'}
    <h1 class="responsive-text {weightClass} {cclass}" style="color:{color}; {mobileStyle}">
        <slot />
    </h1>
{:else if type === 'hd'}
    <h2 class="responsive-text font-black {cclass}" style="color:{color}; {mobileStyle}">
        <slot />
    </h2>
{:else}
    <p class="responsive-text {weightClass} {cclass}" style="color:{color}; {mobileStyle}">
        <slot />
    </p>
{/if}