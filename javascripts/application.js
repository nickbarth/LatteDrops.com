(function () {
  /**
   * Connection - Establish socket channel.
   *
   * @param {String} hash
   */

  function Connection (room) {
    this.firebase = new Firebase('https://lattedrops.firebaseio.com');
    this.shareRoom = this.firebase.child('rooms/'+room);
  };

  /**
   * Send message using channel.
   *
   * @param {string} src
   * @api public
   */

  Connection.prototype.send = function (src) {
    this.shareRoom.set({ "src": src });
  };

  /**
   * Subscribes channel events to function.
   *
   * @param {Function} fn
   * @api public
   */

  Connection.prototype.subscribe = function (fn) {
    this.shareRoom.on('value', function (message) {
      if (message.val()) {
        fn(message.val()['src']);
      }
    });
  };

  /**
   * RoomClient - Sends images using connection.
   *
   * @param {Connection} connection
   * @param {TitleNotification} titleNotification
   * @param {UIEvents} uiEvents
   */

  function RoomClient (connection, titleNotification, uiEvents) {
    this.connection = connection;
    this.titleNotification = titleNotification;
    this.uiEvents = uiEvents;

    this.connection.subscribe(this.receiveImage.bind(this));
  }

  /**
   * Forwards image src to connection.
   *
   * @param {string} src
   * @api public
   */

  RoomClient.prototype.sendImage = function (src) {
    this.connection.send(src);
  };

  /**
   * Receives image src from connection channel.
   *
   * @param {string} src
   * @api private
   */

  RoomClient.prototype.receiveImage = function (src) {
    this.titleNotification.notify();
    this.uiEvents.showShareURL();
    this.uiEvents.updateImage(src);
  };

  /**
   *  Room - Sets up a new image sharing channel.
   */

  function Room () {
    this.connection = null;
    this.roomClient = null;

    this.DropListener = new DropListener(null);
    this.PasteListener = new PasteListener(null);
    this.SelectorListener = new SelectorListener(null);

    this.titleNotification = new TitleNotification();
    this.uiEvents = new UIEvents();

    window.addEventListener('hashchange', this.joinRoom.bind(this), false);
  }

  /**
   * Joins / Creates a new room giving a room name.
   *
   * @param {string} room (takes location.hash as room name on hash change event)
   * @api public
   */

  Room.prototype.joinRoom = function (room) {
    room = typeof room === 'object' ? window.location.hash.substr(1) : room;

    if (room === this.currentRoom) {
      return;
    }

    this.connection = null;
    this.roomClient = null;

    this.uiEvents.hideShareURL();
    this.uiEvents.setWindowHash(room);

    this.connection = new Connection(room);
    this.roomClient = new RoomClient(this.connection, this.titleNotification, this.uiEvents);

    this.DropListener.setRoomClient(this.roomClient);
    this.PasteListener.setRoomClient(this.roomClient);
    this.SelectorListener.setRoomClient(this.roomClient);

    this.currentRoom = room;
    window.location.hash = room;
  };

  /**
   * UploadListener - Base uploader prototype.
   *
   * @param {RoomClient} roomClient
   * @api public
   */

  function UploadListener (roomClient) {
    this.roomClient = roomClient;
  }

  /**
   * Updates current RoomClient.
   *
   * @param {RoomClient} roomClient
   * @api public
   */

  UploadListener.prototype.setRoomClient = function (roomClient) {
    this.roomClient = roomClient;
  }

  /**
   * Sends image to current room and creates a room if none exists.
   *
   * @param {string} src
   * @api public
   */

  UploadListener.prototype.sendImage = function (src) {
    if (this.roomClient === null) {
      var randomRoom = ("0000" + (Math.random()*Math.pow(36,4) << 0).toString(36)).substr(-4);
      window.room.joinRoom(randomRoom);
    }

    this.roomClient.sendImage(src);
  }

  /**
   * DropListener - Listens for drop uploads.
   *
   * @param {RoomClient} roomClient
   * @api public
   */

  function DropListener (roomClient) {
    UploadListener.call(this, roomClient);

    this.fileShareEl = document.getElementById('share-file');
    this.fileShareEl.addEventListener('dragenter', this.dragEnter.bind(this), false);
    this.fileShareEl.addEventListener('dragover', this.dragOver.bind(this), false);
    this.fileShareEl.addEventListener('dragleave', this.dragLeave.bind(this), false);
    this.fileShareEl.addEventListener('drop', this.drop.bind(this), false);
  }

  DropListener.prototype = Object.create(UploadListener.prototype);

  /**
   * Drag enter event.
   *
   * @param {event} event
   * @api private
   */

  DropListener.prototype.dragEnter = function (event) {
    event.dataTransfer.dropEffect = 'move';
    event.target.classList.add('over');
  };

  /**
   * Drag over event.
   *
   * @param {event} event
   * @api private
   */

  DropListener.prototype.dragOver = function (event) {
    event.preventDefault();
  };

  /**
   * Sends dropped image as data url or src.
   *
   * @param {event} event
   * @api private
   */

  DropListener.prototype.drop = function (event) {
    event.stopPropagation();
    event.preventDefault();
    event.target.classList.remove('over');

    if (Utils.isURL(event)) {
      this.sendImage(Utils.getURL(event));
    } else {
      Utils.readURL(event.dataTransfer.files[0], this.sendImage.bind(this));
    }
  };


  /**
   * Drag leave event.
   *
   * @param {event} event
   * @api private
   */

  DropListener.prototype.dragLeave = function (event) {
    event.target.classList.remove('over');
  };

  /**
   * PasteListener - Listens for paste uploads.
   */

  function PasteListener (roomClient) {
    UploadListener.call(this, roomClient);

    document.body.addEventListener('paste', this.paste.bind(this), false);
  }

  PasteListener.prototype = Object.create(UploadListener.prototype);

  /**
   * Sends pasted image as data url or src.
   *
   * @param {event} event
   * @api private
   */

  PasteListener.prototype.paste = function (event) {
    var image = event.clipboardData.items[0];

    function readURLFromString (src) {
      if (src.match('^https?://.+\..+$')) {
        this.sendImage(src);
      }
    }

    if (Utils.isImage(image)) {
      Utils.readURL(image.getAsFile(), this.sendImage.bind(this));
    } else {
      image.getAsString(readURLFromString.bind(this));
    }
  };

  /**
   * UploadListener - Listens for file selector uploads.
   */

  function SelectorListener (roomClient) {
    UploadListener.call(this, roomClient);

    this.uploaderEl = document.getElementById('uploader');
    this.uploaderEl.addEventListener('change', this.uploader.bind(this), false);
  }

  SelectorListener.prototype = Object.create(UploadListener.prototype);

  /**
   * Sends selected image as data url.
   *
   * @params {event} event
   * @api private
   */

  SelectorListener.prototype.uploader = function (event) {
    var image = event.target.files[0];
    Utils.readURL(image, this.sendImage.bind(this));
  };

  /**
   * Utils - Functions for Image Parsing.
   */

  Utils = {
    getURL: function (event) {
      return event.dataTransfer.getData('text/html').match(/src=["'](.+?)['"]/)[1];
    },
    isURL: function (event) {
      return !event.dataTransfer.files.length;
    },
    isImage: function (image) {
      return image.type.match(/image/);
    },
    readURL: function (image, fn) {
      var fileReader = new FileReader();

      if (!Utils.isImage(image)) {
        return;
      }

      function loadURL (event) {
        fn(event.target.result);
      }

      fileReader.readAsDataURL(image);
      fileReader.addEventListener('load', loadURL.bind(this), false);
    }
  }

  /**
   * TitleNotification - Updates title if current tab is not active.
   */

  function TitleNotification () {
    this.hasFocus = true;
    window.addEventListener('focus', function () { this.hasFocus = true; this.notify() }.bind(this), false);
    window.addEventListener('blur', function () { this.hasFocus = false }.bind(this), false);
  }

  /**
   * Updates browser title depending on browser tab focus.
   *
   * @api public
   */

  TitleNotification.prototype.notify = function () {
    var newTitle = document.title.replace(/^[\u2605\u2606]\s|\s[\u2605\u2606]$/g, '');
    if (this.hasFocus) {
      newTitle = "\u2605 "+newTitle+" \u2605";
    } else {
      newTitle = "\u2606 "+newTitle+" \u2606";
    }

    if (document.title !== newTitle) {
      document.title = newTitle;
    }
  }

  /**
   *  UIEvents - Updates Browser UI Elements.
   */

  function UIEvents () {
    this.exampleEl = document.getElementById('example');
    this.shareUrlEl = document.getElementById('share-url');
    this.shareInputEl = this.shareUrlEl.getElementsByTagName('input')[0];
    this.uploadAreaEl = document.getElementById('upload-area');
  }

  /**
   * Sets location hash.
   *
   * @param {string} hash
   * @api public
   */

  UIEvents.prototype.setWindowHash = function (hash) {
    window.location.hash = hash;
    this.shareInputEl.value = window.location.href;
  }

  /**
   * Shows room permalink.
   *
   * @param {string} hash
   * @api public
   */

  UIEvents.prototype.showShareURL = function (hash) {
    this.exampleEl.classList.add('hide');
    this.shareUrlEl.classList.remove('hide');
  };

  /**
   * Resets room UI.
   *
   * @api public
   */

  UIEvents.prototype.hideShareURL = function () {
    this.uploadAreaEl.innerHTML = 'Share Some Drops <i class="icon-cloud-upload"></i>';
    this.exampleEl.classList.remove('hide');
    this.shareUrlEl.classList.add('hide');
  };

  /**
   * Changes current image.
   *
   * @param {string} src
   * @api public
   */

  UIEvents.prototype.updateImage = function (src) {
    this.uploadAreaEl.innerHTML = "<img src='"+src+"'>";
  };

  /**
   * ThemeChanger - Cycles through stylesheet themes.
   */

  function ThemeChanger () {
    this.themeCount = 2;
    this.currentTheme = 1;

    this.themeButton = document.getElementById('theme-changer-button');
    this.styleSheet = document.querySelector('link[href="stylesheets/application1.css"]');

    this.themeButton.addEventListener('click', this.toggleTheme.bind(this), false);
  }


  /**
   * Updates current theme.
   *
   * @api private
   */

  ThemeChanger.prototype.toggleTheme = function () {
    var oldTheme = this.currentTheme;

    this.currentTheme += 1;
    if (this.currentTheme > this.themeCount) {
      this.currentTheme = 1;
    }

    if (this.styleSheet) {
      var oldStyle = 'application' + oldTheme,
        newStyle = 'application' + this.currentTheme;

      this.styleSheet.href = this.styleSheet.href.replace(oldStyle, newStyle);
    }

    return false;
  }

  /**
   * Main Function
   */

  document.addEventListener('DOMContentLoaded', function main () {
    window.room = new Room();

    if (window.location.hash) {
      window.room.joinRoom(window.location.hash.substr(1));
    }

    new ThemeChanger();
  }, false);
})();
