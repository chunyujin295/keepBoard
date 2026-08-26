# GPU 字符渲染

keepBoard 默认使用 WebGL2 绘制字符实例；几何生成仍在 CPU 完成。WebGL2 不可用时自动回退到 Canvas 2D。

## 渲染管线

```text
键鼠输入 / 低帏率待机
        ↓
CPU 形状算法
曲面采样、射线求交、光照、Z-buffer
        ↓
字符实例数组
x、y、字符索引、RGB
        ├──→ CPU Uint8Array 命中遮罩
        ↓
WebGL2 instance buffer
        ↓
一次 drawArraysInstanced
        ↓
字符图集采样、透明混合、GPU 合成
```

## 字符图集

当前字符阶梯在渲染器初始化时绘制到离屏 Canvas，每个字符占据一个等宽纹理格。WebGL2 顶点着色器根据实例中的字符索引生成纹理坐标，每个字符实例只需要六个浮点数：

- 字符格 `x / y`
- 字符图集索引
- `r / g / b`

所有字符共享一个四顶点 `TRIANGLE_STRIP`，通过 `drawArraysInstanced` 一次提交。

## CPU/GPU 分工

| 工作 | 执行位置 |
|---|---|
| 参数曲面、隐式曲面、射线求交 | CPU |
| 旋转、光照、字符选择、Z-buffer | CPU |
| 字符四边形展开、纹理采样 | GPU |
| 透明混合、CSS 光晕、窗口合成 | GPU/Chromium |
| 鼠标穿透命中判断 | CPU 字符格遮罩 |

保留 CPU 几何的原因是八种形状使用了不同算法。当前方案消除了每帧成千上万次 `CanvasRenderingContext2D.fillText`，同时避免为每种形状维护独立 shader。

## 鼠标穿透

旧实现会在每次鼠标移动时调用 `getImageData`。GPU 后端下这会强制等待显卡完成并把像素复制回 CPU。

现在每帧根据最终字符实例同步更新 `Uint8Array` 字符格遮罩。鼠标移动只检查指针附近的少量格子，不再发生 GPU 像素回读。

## 回退与诊断

- WebGL2 创建失败时使用原 Canvas 2D 字符绘制。
- Canvas 元素的 `data-renderer` 为 `webgl2` 或 `canvas2d`，便于开发环境确认实际后端。
- 开发模式可附加 `?renderer=canvas2d` 强制验证回退路径。
- 开发模式可附加 `?spin=1` 模拟持续键鼠输入，用于比较动画不同时刻；可与 `?shape=saturn` 等形状参数组合。
- 形状算法、颜色、字符集、Z-buffer 和命中遮罩由两个后端共享。
- 不新增原生依赖，不改变 Electron 打包方式。

## 后续方向

如果 GPU 字符绘制仍不足，可按形状逐步迁移几何：球体、立方体、土星适合 fragment shader 射线求交；甜甜圈和莫比乌斯环适合参数曲面顶点着色器；爱心适合 ray marching。此类迁移应以真实性能数据为依据。
