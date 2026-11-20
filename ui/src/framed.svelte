<!--
  A camera picture with the regions the detector flagged drawn over it. The
  boxes arrive in the picture's own pixels, so the overlay takes the picture's
  natural size as its view box and crops exactly as the picture does.
-->
<script lang="ts">
  import type { Box } from './guard';

  let {
    src,
    alt,
    boxes = [],
    class: className = '',
  }: {
    src: string;
    alt: string;
    boxes?: readonly Box[] | null | undefined;
    class?: string;
  } = $props();

  let width = $state(0);
  let height = $state(0);

  const loaded = (e: Event) => {
    const img = e.currentTarget as HTMLImageElement;
    width = img.naturalWidth;
    height = img.naturalHeight;
  };

  const shown = $derived(
    width > 0 ? (boxes ?? []).filter((box) => box.w > 0 && box.h > 0) : [],
  );
</script>

<div class="relative overflow-hidden rounded-md bg-muted {className}">
  <img class="size-full object-cover" {src} {alt} onload={loaded} />
  {#if shown.length > 0}
    <svg
      class="pointer-events-none absolute inset-0 size-full"
      viewBox="0 0 {width} {height}"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {#each shown as box, index (index)}
        <rect
          class="fill-destructive/10 stroke-destructive"
          x={box.x}
          y={box.y}
          width={box.w}
          height={box.h}
          rx="2"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
        />
      {/each}
    </svg>
    <span
      class="absolute top-2 left-2 rounded-sm bg-background/90 px-1.5 py-0.5 text-xs font-medium text-destructive"
      >{shown.length}</span
    >
  {/if}
</div>
