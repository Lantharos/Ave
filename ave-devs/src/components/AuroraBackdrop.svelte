<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Color, Mesh, Program, Renderer, Triangle } from "ogl";

  type PresetName = "login" | "dashboard-tr" | "dashboard-bl";

  type Preset = {
    colorStops: [string, string, string];
    amplitude: number;
    blend: number;
    height: number;
    position: "bottom" | "top";
    opacity: number;
  };

  const presets: Record<PresetName, Preset> = {
    login: {
      colorStops: ["#878787", "#646464", "#3c3c3c"],
      amplitude: 1.0,
      blend: 0.5,
      height: 420,
      position: "bottom",
      opacity: 1,
    },
    "dashboard-tr": {
      colorStops: ["#737579", "#5a5e62", "#393b3d"],
      amplitude: 0.85,
      blend: 0.6,
      height: 520,
      position: "top",
      opacity: 0.9,
    },
    "dashboard-bl": {
      colorStops: ["#797979", "#646464", "#3c3c3c"],
      amplitude: 0.85,
      blend: 0.6,
      height: 520,
      position: "bottom",
      opacity: 0.9,
    },
  };

  let { preset = "login", cclass = "" }: { preset?: PresetName; cclass?: string } = $props();
  let container: HTMLDivElement | null = null;

  const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

  const FRAG = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uOpacity;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v){
  const vec4 C = vec4(
      0.211324865405187, 0.366025403784439,
      -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
    + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
      0.5 - vec3(
          dot(x0, x0),
          dot(x12.xy, x12.xy),
          dot(x12.zw, x12.zw)
      ),
      0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);

  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

#define COLOR_RAMP(colors, factor, finalColor) {              \
  int index = 0;                                            \
  for (int i = 0; i < 2; i++) {                               \
     ColorStop currentColor = colors[i];                    \
     bool isInBetween = currentColor.position <= factor;    \
     index = int(mix(float(index), float(i), float(isInBetween))); \
  }                                                         \
  ColorStop currentColor = colors[index];                   \
  ColorStop nextColor = colors[index + 1];                  \
  float range = nextColor.position - currentColor.position; \
  float lerpFactor = (factor - currentColor.position) / range; \
  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop colors[3];
  colors[0] = ColorStop(uColorStops[0], 0.0);
  colors[1] = ColorStop(uColorStops[1], 0.5);
  colors[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor;
  COLOR_RAMP(colors, uv.x, rampColor);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;

  float midPoint = 0.20;
  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);

  vec3 auroraColor = intensity * rampColor;

  fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha * uOpacity);
}
`;

  let renderer: Renderer | null = null;
  let program: Program | null = null;
  let mesh: Mesh | null = null;
  let raf = 0;
  let resizeObserver: ResizeObserver | null = null;

  function setup() {
    if (!container) return;
    const presetConfig = presets[preset];

    renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    });

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = "transparent";
    gl.canvas.style.width = "100%";
    gl.canvas.style.height = "100%";

    const geometry = new Triangle(gl) as Triangle & { attributes?: { uv?: unknown } };
    if (geometry.attributes?.uv) {
      delete geometry.attributes.uv;
    }

    const colorStopsArray = presetConfig.colorStops.map((hex: string) => {
      const color = new Color(hex);
      return [color.r, color.g, color.b] as [number, number, number];
    });

    program = new Program(gl, {
      vertex: VERT,
      fragment: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: presetConfig.amplitude },
        uColorStops: { value: colorStopsArray },
        uResolution: { value: [container.offsetWidth, container.offsetHeight] },
        uBlend: { value: presetConfig.blend },
        uOpacity: { value: presetConfig.opacity },
      },
    });

    mesh = new Mesh(gl, { geometry, program });
    container.appendChild(gl.canvas);

    const update = (t: number) => {
      raf = requestAnimationFrame(update);
      if (!program || !renderer || !mesh) return;
      program.uniforms.uTime.value = t * 0.0008;
      renderer.render({ scene: mesh });
    };

    raf = requestAnimationFrame(update);

    const resize = () => {
      if (!container || !renderer || !program) return;
      const width = container.offsetWidth;
      const height = container.offsetHeight;
      renderer.setSize(width, height);
      program.uniforms.uResolution.value = [width, height];
    };

    resize();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
  }

  function teardown() {
    cancelAnimationFrame(raf);
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (renderer?.gl?.canvas && container && renderer.gl.canvas.parentNode === container) {
      container.removeChild(renderer.gl.canvas);
    }
    renderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();
    renderer = null;
    program = null;
    mesh = null;
  }

  onMount(() => {
    setup();
    return teardown;
  });

  onDestroy(() => {
    teardown();
  });
</script>

<div
  bind:this={container}
  class={`aurora-backdrop ${cclass} ${presets[preset].position === "top" ? "aurora-top" : "aurora-bottom"}`}
  style={`height: ${presets[preset].height}px;`}
></div>

<style>
  .aurora-backdrop {
    position: absolute;
    left: 0;
    width: 100%;
    pointer-events: none;
    user-select: none;
    z-index: 0;
    opacity: 1;
    mix-blend-mode: normal;
  }

  .aurora-bottom {
    bottom: 0;
    transform: scaleY(-1);
  }

  .aurora-top {
    top: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .aurora-backdrop {
      display: none;
    }
  }
</style>
