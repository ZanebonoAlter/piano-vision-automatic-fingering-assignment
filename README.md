# Piano Vision 指法分配工具（中文翻译版）

这个基于 Web 的应用程序专门设计用于处理从 **Piano Vision**（Meta Quest 的 VR 应用）导出的 JSON 文件。该工具通过考虑手部大小和移动效率，帮助钢琴家和音乐爱好者为钢琴曲目分配最优指法，从而增强在 Piano Vision 环境中的练习和演奏体验。

额外为工具添加可视化器，并添加了音频引擎。基于源代码，对指法分配进行优化，左手使用镜像映射
![image](imgs/image.png)
## 功能特性

- **高级指法算法**：采用从 [pianoplayer Python 库](https://github.com/marcomusy/pianoplayer/) 改编的算法，为每个音符分配最优指法。
- **手部大小自定义**：允许用户选择手部大小（从 XXS 到 XXL），以个性化指法建议。
- **与 Piano Vision 集成**：专门处理从 Piano Vision 应用导出的 JSON 文件。
- **JSON 文件处理**：输出带有已分配指法的更新 JSON 文件，可直接导入回 Piano Vision。
- **用户友好界面**：简单的拖放功能，用于上传文件和下载结果。
- **基于浏览器**：完全在浏览器中运行；无需安装或服务器设置。

## 快速开始

### 前置要求

- 现代 Web 浏览器（例如 Chrome、Firefox、Edge）。
- 从 Meta Quest 上的 Piano Vision 应用导出的 JSON 文件。

### 安装

无需安装。只需下载 HTML 文件并在 Web 浏览器中打开即可。visualizer.html为可视化网页，index.html为转换网页
