(function () {
  function Connection (hash) {
    this.firebase = new Firebase('https://lattedrops.firebaseio.com');
    this.shareRoom = this.firebase.child('rooms/'+hash);
  };

  Connection.prototype.send = function (src) {
    this.shareRoom.set({ "src": src });
  };

  Connection.prototype.bindMessage = function (func) {
    this.shareRoom.on('value', function (message) {
      func(message.val()['src']);
    });
  };

  function FileShare (fileShare, example, shareUrl, hash) {
    var input;

    this.hash = hash ? hash : ("0000" + (Math.random()*Math.pow(36,4) << 0).toString(36)).substr(-4);
    this.connection = null;
    this.fileShareEl = document.getElementById(fileShare);
    this.exampleEl = document.getElementById(example);
    this.shareUrlEl = document.getElementById(shareUrl);
    this.shareInputEl = this.shareUrlEl.getElementsByTagName('input')[0];

    this.shareUrlEl.addEventListener('click', function (element) { element.target.select() }, false);
    this.fileShareEl.addEventListener('dragenter', this.dragEnter.bind(this), false);
    this.fileShareEl.addEventListener('dragover', this.dragOver.bind(this), false);
    this.fileShareEl.addEventListener('dragleave', this.dragLeave.bind(this), false);
    this.fileShareEl.addEventListener('drop', this.drop.bind(this), false);

    document.body.addEventListener('paste', this.paste.bind(this), false);

    if (hash) {
      this.getConnection();
    }
  };

  FileShare.prototype.getHash = function () {
    return this.hash;
  };

  FileShare.prototype.getConnection = function () {
    if (!this.connection) {
      window.location.hash = this.hash;
      this.connection = new Connection(this.hash);
      this.connection.bindMessage(this.receiveMessage.bind(this));
      this.exampleEl.classList.add('hide');
      this.shareUrlEl.classList.remove('hide');
      this.shareInputEl.value = window.location.href;
    }

    return this.connection;
  };

  FileShare.prototype.receiveMessage = function (src) {
    this.fileShareEl.innerHTML = "<img src='"+src+"'>";
  };

  FileShare.prototype.dragEnter = function (event) {
    event.dataTransfer.dropEffect = 'move';
    event.target.classList.add('over');
  };

  FileShare.prototype.dragOver = function (event) {
    event.preventDefault();
  };

  FileShare.prototype.sendURL = function (url) {
    var connection = this.getConnection()
    connection.send(url);
  };

  FileShare.prototype.sendUpload = function (image) {
    var fileReader = new FileReader();

    fileReader.readAsDataURL(image);
    fileReader.addEventListener('load', function (event) {
      this.sendURL(event.target.result);
    }.bind(this), false);
  };

  FileShare.prototype.readURL = function (event) {
    return event.dataTransfer.getData('text/html').match(/src=["'](.+?)['"]/)[1];
  };

  FileShare.prototype.paste = function (event) {
    var image = event.clipboardData.items[0];
    if (image.type.match(/text/)) {
      image.getAsString(function (url) {
        if (url.match('^https?://.+\..+$')) {
          this.sendURL(url);
        }
      }.bind(this));
    } else if (image.type.match(/image/)) {
      this.sendUpload(image.getAsFile());
    }
  };

  FileShare.prototype.drop = function (event) {
    event.stopPropagation();
    event.preventDefault();
    event.target.classList.remove('over');

    if (event.dataTransfer.files.length) {
      this.sendUpload(event.dataTransfer.files[0]);
    } else {
      this.sendURL(this.readURL(event));
    }
  };

  FileShare.prototype.dragLeave = function (event) {
    event.target.classList.remove('over');
  };

  if (window.location.hash === "") {
    fileShare = new FileShare('share-file', 'example', 'share-url', null);
  } else {
    fileShare = new FileShare('share-file', 'example', 'share-url', window.location.hash.substr(1));
  }

  window.addEventListener("hashchange", function () {
    if (window.location.hash.substr(1) !== fileShare.getHash()) {
      window.location.reload(true);
    }
  }, false);
})();
