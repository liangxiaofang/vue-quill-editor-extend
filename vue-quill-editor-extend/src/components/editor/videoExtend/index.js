/**
 *@description 观察者模式 全局监听富文本编辑器
 */
export const QuillVideoWatch = {
  watcher: {},  // 登记编辑器信息
  active: null,  // 当前触发的编辑器
  on: function (videoExtendId, VideoExtend) {  // 登记注册使用了videoEXtend的编辑器
      if (!this.watcher[videoExtendId]) {
          this.watcher[videoExtendId] = VideoExtend
      }
  },
  emit: function (activeId, type = 1) {  // 事件发射触发
      this.active = this.watcher[activeId]
      if (type === 1) {
          videoHandler()
      }
  }
}

/**
* @description 视频功能拓展： 增加上传 拖动 复制
*/
export class VideoExtend {
  /**
   * @param quill {Quill}富文本实例
   * @param config {Object} options
   * config  keys: action, headers, editForm start end error  size response
   */
  constructor(quill, config = {}) {
      this.id = Math.random()
      this.quill = quill
      this.quill.id = common.isEmpty(this.quill.id) ? this.id : this.quill.id
      console.log("video:" + this.quill.id)
      this.config = config
      this.file = ''  // 要上传的视频
      this.videoURL = ''  // 视频地址
      quill.root.addEventListener('paste', this.pasteHandle.bind(this), false)
      quill.root.addEventListener('drop', this.dropHandle.bind(this), false)
      quill.root.addEventListener('dropover', function (e) {
          e.preventDefault()
      }, false)
      this.cursorIndex = 0
      QuillVideoWatch.on(this.quill.id, this)
  }

  /**
   * @description 粘贴
   * @param e
   */
  pasteHandle(e) {
      // e.preventDefault()
      QuillVideoWatch.emit(this.quill.id, 0)
      let clipboardData = e.clipboardData
      let i = 0
      let items, item, types

      if (clipboardData) {
          items = clipboardData.items;

          if (!items) {
              return;
          }
          item = items[0];
          types = clipboardData.types || [];

          for (; i < types.length; i++) {
              if (types[i] === 'Files') {
                  item = items[i];
                  break;
              }
          }
          if (item && item.kind === 'file' && item.type.match(/^image\//i)) {
              this.file = item.getAsFile()
              let self = this
              // 如果视频限制大小
              if (self.config.size && self.file.size >= self.config.size * 1024 * 1024) {
                  if (self.config.sizeError) {
                      self.config.sizeError()
                  }
                  return
              }
              if (this.config.action) {
                  // this.uploadVideo()
              } else {
                  // this.toBase64()
              }
          }
      }
  }

  /**
   * 拖拽
   * @param e
   */
  dropHandle(e) {
      QuillVideoWatch.emit(this.quill.id, 0)
      const self = this
      e.preventDefault()
      // 如果视频限制大小
      if (self.config.size && self.file.size >= self.config.size * 1024 * 1024) {
          if (self.config.sizeError) {
              self.config.sizeError()
          }
          return
      }
      self.file = e.dataTransfer.files[0]; // 获取到第一个上传的文件对象
      if (this.config.action) {
          self.uploadVideo()
      } else {
          self.toBase64()
      }
  }

  /**
   * @description 将视频转为base4
   */
  toBase64() {
      const self = this
      const reader = new FileReader()
      reader.onload = (e) => {
          // 返回base64
          self.videoURL = e.target.result
          self.insertVideo()
      }
      reader.readAsDataURL(self.file)
  }

  /**
   * @description 上传视频到服务器
   */
  uploadVideo() {
      const self = this
      let quillLoading = self.quillLoading
      let config = self.config
      // 构造表单
      let formData = new FormData()
      formData.append(config.name, self.file)
      // 自定义修改表单
      if (config.editForm) {
          config.editForm(formData)
      }
      // 创建ajax请求
      let xhr = new XMLHttpRequest()
      xhr.open('post', config.action, true)
      // 如果有设置请求头
      if (config.headers) {
          config.headers(xhr)
      }
      if (config.change) {
          config.change(xhr, formData)
      }
      xhr.onreadystatechange = function () {
          if (xhr.readyState === 4) {
              if (xhr.status === 200) {
                  //success
                  let res = JSON.parse(xhr.responseText)
                  self.videoURL = config.response(res)
                  QuillVideoWatch.active.uploadSuccess()
                  self.insertVideo()
                  if (self.config.success) {
                      self.config.success()
                  }
              } else {
                  //error
                  if (self.config.error) {
                      self.config.error()
                  }
                  QuillVideoWatch.active.uploadError()
              }
          }
      }
      // 开始上传数据
      xhr.upload.onloadstart = function (e) {
          QuillVideoWatch.active.uploading()
          // let length = (self.quill.getSelection() || {}).index || self.quill.getLength()
          // self.quill.insertText(length, '[uploading...]', { 'color': 'red'}, true)
          if (config.start) {
              config.start()
          }
      }
      // 上传过程
      xhr.upload.onprogress = function (e) {
          let complete = (e.loaded / e.total * 100 | 0) + '%'
          QuillVideoWatch.active.progress(complete)
      }
      // 当发生网络异常的时候会触发，如果上传数据的过程还未结束
      xhr.upload.onerror = function (e) {
          QuillVideoWatch.active.uploadError()
          if (config.error) {
              config.error()
          }
      }
      // 上传数据完成（成功或者失败）时会触发
      xhr.upload.onloadend = function (e) {
          if (config.end) {
              config.end()
          }
      }
      xhr.send(formData)
  }

  /**
   * @description 往富文本编辑器插入视频
   */
  insertVideo() {
      debugger;
      const self = QuillVideoWatch.active
      self.quill.insertEmbed(QuillVideoWatch.active.cursorIndex, 'video', self.videoURL)
      self.quill.update()
      self.quill.setSelection(self.cursorIndex+1);
  }

  /**
   * @description 显示上传的进度
   */
  progress(pro) {
      pro = '[' + 'uploading' + pro + ']'
      QuillVideoWatch.active.quill.root.innerHTML
          = QuillVideoWatch.active.quill.root.innerHTML.replace(/\[uploading.*?\]/, pro)
  }

  /**
   * 开始上传
   */
  uploading() {
      let length = (QuillVideoWatch.active.quill.getSelection() || {}).index || QuillVideoWatch.active.quill.getLength()
      QuillVideoWatch.active.cursorIndex = length
      QuillVideoWatch.active.quill.insertText(QuillVideoWatch.active.cursorIndex, '[uploading...]', {'color': 'red'}, true)
  }

  /**
   * 上传失败
   */
  uploadError() {
      QuillVideoWatch.active.quill.root.innerHTML
          = QuillVideoWatch.active.quill.root.innerHTML.replace(/\[uploading.*?\]/, '[upload error]')
  }

  uploadSuccess() {
      QuillVideoWatch.active.quill.root.innerHTML
          = QuillVideoWatch.active.quill.root.innerHTML.replace(/\[uploading.*?\]/, '')
  }
}

/**
* @description 点击视频上传
*/
export function videoHandler() {
  let fileInput = document.querySelector('.quill-video-input');
  if (fileInput === null) {
      fileInput = document.createElement('input');
      fileInput.setAttribute('type', 'file');
      fileInput.classList.add('quill-video-input');
      fileInput.style.display = 'none'
      // 监听选择文件
      fileInput.addEventListener('change', function () {
          let self = QuillVideoWatch.active
          self.file = fileInput.files[0]
          fileInput.value = ''
          // 如果视频限制大小
          if (self.config.size && self.file.size >= self.config.size * 1024 * 1024) {
              if (self.config.sizeError) {
                  self.config.sizeError()
              }
              return
          }
          if (self.config.action) {
              self.uploadVideo()
          } else {
              self.toBase64()
          }
      })
      document.body.appendChild(fileInput);
  }
  fileInput.click();
}

/**
*@description 全部工具栏
*/
export const container = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{'header': 1}, {'header': 2}],
  [{'list': 'ordered'}, {'list': 'bullet'}],
  [{'script': 'sub'}, {'script': 'super'}],
  [{'indent': '-1'}, {'indent': '+1'}],
  [{'direction': 'rtl'}],
  [{'size': ['small', false, 'large', 'huge']}],
  [{'header': [1, 2, 3, 4, 5, 6, false]}],
  [{'color': []}, {'background': []}],
  [{'font': []}],
  [{'align': []}],
  ['clean'],
  ['link', 'image', 'video']
]



