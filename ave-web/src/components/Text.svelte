<script lang="ts">
    export let type: 'h' | 'hd' | 'p' = 'p';
    export let weight: 'normal' | 'medium' | 'bold' | 'black' = 'normal';
    export let size: number = type === 'h' ? 40 : type === 'hd' ? 18 : 24;
    export let color: string = type === 'p' ? '#878787' : '#D3D3D3';
    export let cclass: string = '';

    $: weightClass =
        weight === 'normal' ? 'font-normal' :
            weight === 'medium' ? 'font-medium' :
                weight === 'bold' ? 'font-extrabold' :
                    'font-black';
</script>

{#if type === 'h'}
    <h1 class={weightClass + ' ' + cclass} style="color:{color}; font-size:{size}px">
        <slot />
    </h1>
{:else if type === 'hd'}
    <h2 class="font-black {cclass}" style="color:{color}; font-size:{size}px">
        <slot />
    </h2>
{:else}
    <p style="color:{color}; font-size:{size}px" class={weightClass + ' ' + cclass}>
        <slot />
    </p>
{/if}