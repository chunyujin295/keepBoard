export interface GlyphInstance {
  x: number
  y: number
  ch: string
  col: string
}

type RendererOptions = {
  cols: number
  rows: number
  cellWidth: number
  cellHeight: number
  glyphWidth: number
  glyphHeight: number
  cssWidth: number
  cssHeight: number
  chars: string
  fontPx: number
  dark: boolean
  glow: boolean
}

const vertexSource = `#version 300 es
precision highp float;
layout(location=0) in vec2 a_corner;
layout(location=1) in vec3 a_instance;
layout(location=2) in vec3 a_color;
uniform vec2 u_canvas;
uniform vec2 u_cell;
uniform vec2 u_glyph;
uniform float u_glyph_count;
out vec2 v_uv;
out vec3 v_color;
void main() {
  vec2 pixel = a_instance.xy * u_cell + a_corner * u_glyph;
  vec2 clip = vec2(pixel.x / u_canvas.x * 2.0 - 1.0,
                   1.0 - pixel.y / u_canvas.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  v_uv = vec2((a_instance.z + a_corner.x) / u_glyph_count, a_corner.y);
  v_color = a_color;
}`

const fragmentSource = `#version 300 es
precision mediump float;
uniform sampler2D u_atlas;
in vec2 v_uv;
in vec3 v_color;
out vec4 out_color;
void main() {
  float alpha = texture(u_atlas, v_uv).a;
  if (alpha < 0.02) discard;
  out_color = vec4(v_color * alpha, alpha);
}`

function shader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const out = gl.createShader(type)
  if (!out) throw new Error('Unable to create WebGL shader')
  gl.shaderSource(out, source)
  gl.compileShader(out)
  if (!gl.getShaderParameter(out, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(out) || 'WebGL shader compilation failed'
    gl.deleteShader(out)
    throw new Error(message)
  }
  return out
}

function program(gl: WebGL2RenderingContext): WebGLProgram {
  const vs = shader(gl, gl.VERTEX_SHADER, vertexSource)
  const fs = shader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  const out = gl.createProgram()
  if (!out) throw new Error('Unable to create WebGL program')
  gl.attachShader(out, vs)
  gl.attachShader(out, fs)
  gl.linkProgram(out)
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  if (!gl.getProgramParameter(out, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(out) || 'WebGL program link failed'
    gl.deleteProgram(out)
    throw new Error(message)
  }
  return out
}

function rgb(value: string): [number, number, number] {
  const match = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(value)
  return match
    ? [+match[1] / 255, +match[2] / 255, +match[3] / 255]
    : [1, 1, 1]
}

export class WebGLGlyphRenderer {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private gpuProgram: WebGLProgram
  private vao: WebGLVertexArrayObject
  private quadBuffer: WebGLBuffer
  private instanceBuffer: WebGLBuffer
  private texture: WebGLTexture
  private uCanvas: WebGLUniformLocation | null
  private uCell: WebGLUniformLocation | null
  private uGlyph: WebGLUniformLocation | null
  private uGlyphCount: WebGLUniformLocation | null
  private data = new Float32Array(0)
  private colors = new Map<string, [number, number, number]>()
  private glyphIndex = new Map<string, number>()
  private glyphCount: number
  private options: RendererOptions

  static create(canvas: HTMLCanvasElement, options: RendererOptions): WebGLGlyphRenderer | null {
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false
    })
    if (!gl) return null
    return new WebGLGlyphRenderer(gl, canvas, options)
  }

  private constructor(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement, options: RendererOptions) {
    this.gl = gl
    this.canvas = canvas
    this.options = options
    this.glyphCount = Array.from(options.chars).length
    this.gpuProgram = program(gl)
    this.uCanvas = gl.getUniformLocation(this.gpuProgram, 'u_canvas')
    this.uCell = gl.getUniformLocation(this.gpuProgram, 'u_cell')
    this.uGlyph = gl.getUniformLocation(this.gpuProgram, 'u_glyph')
    this.uGlyphCount = gl.getUniformLocation(this.gpuProgram, 'u_glyph_count')
    const vao = gl.createVertexArray()
    const quadBuffer = gl.createBuffer()
    const instanceBuffer = gl.createBuffer()
    const texture = gl.createTexture()
    if (!vao || !quadBuffer || !instanceBuffer || !texture) throw new Error('Unable to allocate WebGL resources')
    this.vao = vao
    this.quadBuffer = quadBuffer
    this.instanceBuffer = instanceBuffer
    this.texture = texture

    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer)
    const stride = 6 * 4
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 3 * 4)
    gl.vertexAttribDivisor(2, 1)

    const atlas = document.createElement('canvas')
    const scale = 3
    const tileW = Math.max(16, Math.ceil(options.glyphWidth * scale))
    const tileH = Math.max(16, Math.ceil(options.glyphHeight * scale))
    atlas.width = tileW * this.glyphCount
    atlas.height = tileH
    const ctx = atlas.getContext('2d')!
    ctx.clearRect(0, 0, atlas.width, atlas.height)
    ctx.fillStyle = '#fff'
    ctx.font = `${options.fontPx * scale}px Consolas, "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    Array.from(options.chars).forEach((ch, i) => {
      this.glyphIndex.set(ch, i)
      ctx.fillText(ch, i * tileW + tileW / 2, tileH / 2)
    })

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.useProgram(this.gpuProgram)
    gl.uniform1i(gl.getUniformLocation(this.gpuProgram, 'u_atlas'), 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    canvas.style.filter = options.glow
      ? `drop-shadow(0 0 ${Math.max(1.5, options.fontPx * 0.4)}px ${options.dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.5)'})`
      : 'none'
    canvas.dataset.renderer = 'webgl2'
  }

  draw(cells: GlyphInstance[], count: number): void {
    const gl = this.gl
    const needed = count * 6
    if (this.data.length < needed) this.data = new Float32Array(Math.max(needed, this.data.length * 2, 1024))
    for (let i = 0; i < count; i++) {
      const cell = cells[i]
      let color = this.colors.get(cell.col)
      if (!color) { color = rgb(cell.col); this.colors.set(cell.col, color) }
      const o = i * 6
      this.data[o] = cell.x
      this.data[o + 1] = cell.y
      this.data[o + 2] = this.glyphIndex.get(cell.ch) ?? 0
      this.data[o + 3] = color[0]
      this.data[o + 4] = color[1]
      this.data[o + 5] = color[2]
    }
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.gpuProgram)
    gl.bindVertexArray(this.vao)
    gl.uniform2f(this.uCanvas, this.options.cssWidth, this.options.cssHeight)
    gl.uniform2f(this.uCell, this.options.cellWidth, this.options.cellHeight)
    gl.uniform2f(this.uGlyph, this.options.glyphWidth, this.options.glyphHeight)
    gl.uniform1f(this.uGlyphCount, this.glyphCount)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, needed), gl.DYNAMIC_DRAW)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteTexture(this.texture)
    gl.deleteBuffer(this.instanceBuffer)
    gl.deleteBuffer(this.quadBuffer)
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.gpuProgram)
    delete this.canvas.dataset.renderer
  }
}
