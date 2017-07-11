define(['histmap', 'bootstrap', 'underscore', 'model/map', 'contextmenu', 'geocoder', 'switcher'],
    function(ol, bsn, _, Map, ContextMenu, Geocoder) {
        var labelFontStyle = "Normal 12px Arial";
        const {ipcRenderer} = require('electron');
        var backend = require('electron').remote.require('../lib/mapedit');
        backend.init();
        var uploader;
        var mapID;
        var newlyAddGcp;
        var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
        for (var i = 0; i < hashes.length; i++) {
            hash = hashes[i].split('=');
            if (hash[0] == 'mapid') mapID = hash[1];
        }

        function getTextWidth ( _text, _fontStyle ) {
            var canvas = undefined,
                context = undefined,
                metrics = undefined;

            canvas = document.createElement( "canvas" );

            context = canvas.getContext( "2d" );

            context.font = _fontStyle;
            metrics = context.measureText( _text );

            return metrics.width;
        }

        function gcpsToMarkers (gcps) {
            illstMap.resetMarker();
            mercMap.resetMarker();

            for (var i=0; i<gcps.length; i++) {
                var gcp = gcps[i];
                var mapXyIllst = illstSource.xy2HistMapCoords(gcp[0]);

                var labelWidth = getTextWidth( (i + 1), labelFontStyle ) + 10;

                var iconSVG = '<svg ' +
                    'version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
                    'x="0px" y="0px" width="' + labelWidth + 'px" height="20px" ' +
                    'viewBox="0 0 ' + labelWidth + ' 20" enable-background="new 0 0 ' + labelWidth + ' 20" xml:space="preserve">'+
                    '<polygon x="0" y="0" points="0,0 ' + labelWidth + ',0 ' + labelWidth + ',16 ' + (labelWidth / 2 + 4) + ',16 ' +
                    (labelWidth / 2) + ',20 ' + (labelWidth / 2 - 4) + ',16 0,16 0,0" stroke="#000000" fill="#DEEFAE" stroke-width="2"></polygon>' +
                    '<text x="5" y="13" fill="#000000" font-family="Arial" font-size="12" font-weight="normal">' + (i + 1) + '</text>' +
                    '</svg>';

                var imageElement = new Image();
                imageElement.src = 'data:image/svg+xml,' + encodeURIComponent( iconSVG );

                var iconStyle = new ol.style.Style({
                    "image": new ol.style.Icon({
                        "img": imageElement,
                        "imgSize":[labelWidth, 70],
                        "anchor": [0.5, 1],
                        "offset": [0, -50]
                    })
                });

                illstMap.setMarker(mapXyIllst, { gcpIndex: i }, iconStyle);
                mercMap.setMarker(gcp[1], { gcpIndex: i }, iconStyle);
            }
        }

        function removeMarker (arg, map) {
            var marker = arg.data.marker;
            var gcpIndex = marker.get('gcpIndex');
            if (gcpIndex == 'new') {
                newlyAddGcp = null;
                map._marker_source.removeFeature(marker);
            } else {
                var gcps = mapObject.get('gcps');
                gcps.splice(gcpIndex, 1);
                mapObject.set('gcps', gcps);
                mapObject.trigger('change:gcps', mapObject, gcps);
                mapObject.trigger('change', mapObject);
                gcpsToMarkers(gcps);
            }
        }

        function addNewMarker (arg, map) {
            var gcps = mapObject.get('gcps');
            var number = gcps.length + 1;
            var isIllst = map == illstMap;
            var coord = arg.coordinate;
            var xy = isIllst ? illstSource.histMapCoords2Xy(coord) : coord;

            if (!newlyAddGcp) {
                var labelWidth = getTextWidth( number, labelFontStyle ) + 10;

                var iconSVG = '<svg ' +
                    'version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
                    'x="0px" y="0px" width="' + labelWidth + 'px" height="20px" ' +
                    'viewBox="0 0 ' + labelWidth + ' 20" enable-background="new 0 0 ' + labelWidth + ' 20" xml:space="preserve">'+
                    '<polygon x="0" y="0" points="0,0 ' + labelWidth + ',0 ' + labelWidth + ',16 ' + (labelWidth / 2 + 4) + ',16 ' +
                    (labelWidth / 2) + ',20 ' + (labelWidth / 2 - 4) + ',16 0,16 0,0" stroke="#000000" fill="#FFCCCC" stroke-width="2"></polygon>' +
                    '<text x="5" y="13" fill="#000000" font-family="Arial" font-size="12" font-weight="normal">' + number + '</text>' +
                    '</svg>';

                var imageElement = new Image();
                imageElement.src = 'data:image/svg+xml,' + encodeURIComponent( iconSVG );

                var iconStyle = new ol.style.Style({
                    "image": new ol.style.Icon({
                        "img": imageElement,
                        "imgSize":[labelWidth, 70],
                        "anchor": [0.5, 1],
                        "offset": [0, -50]
                    })
                });

                map.setMarker(coord, { gcpIndex: 'new' }, iconStyle);

                newlyAddGcp = isIllst ? [xy, ] : [, xy];
            } else if ((isIllst && !newlyAddGcp[0]) || (!isIllst && !newlyAddGcp[1])) {
                if (isIllst) { newlyAddGcp[0] = xy; } else { newlyAddGcp[1] = xy; }
                gcps.push(newlyAddGcp);
                mapObject.set('gcps', gcps);
                mapObject.trigger('change:gcps', mapObject, gcps);
                mapObject.trigger('change', mapObject);
                gcpsToMarkers(gcps);
                newlyAddGcp = null;
            }
        }

        var eventInit = false;
        function setEventListner() {
            var a = document.querySelector('a[href="#gcpsTab"]');
            var li = a.parentNode;
            if (mapObject.gcpsEditReady()) {
                li.classList.remove('disabled');
            } else {
                li.classList.add('disabled');
            }
            mapObject.on('change', function(ev){
                if (mapObject.dirty() && mapObject.isValid()) {
                    document.querySelector('#saveMap').removeAttribute('disabled');
                } else {
                    document.querySelector('#saveMap').setAttribute('disabled', true);
                }
                var a = document.querySelector('a[href="#gcpsTab"]');
                var li = a.parentNode;
                if (mapObject.gcpsEditReady()) {
                    li.classList.remove('disabled');
                } else {
                    li.classList.add('disabled');
                }
                document.querySelector('#width').value = mapObject.get('width');
                document.querySelector('#height').value = mapObject.get('height');
            });
            if (eventInit) return;
            eventInit = true;
            var allowClose = false;
            document.querySelector('a[data-nav]').addEventListener('click', function(ev) {
                if (!mapObject.dirty() || confirm('地図に変更が加えられていますが保存されていません。\n保存せずに閉じてよいですか?')) {
                    allowClose = true;
                    window.location.href = ev.target.getAttribute('data-nav');
                }
            });
            window.addEventListener('beforeunload', function(e) {
                if (!mapObject.dirty()) return;
                if (allowClose) {
                    allowClose = false;
                    return;
                }
                e.returnValue = 'false';
                setTimeout(function() {
                    if (confirm('地図に変更が加えられていますが保存されていません。\n保存せずに閉じてよいですか?')) {
                        allowClose = true;
                        window.close();
                    }
                }, 2);
            });
            document.querySelector('#title').addEventListener('change', function(ev) {
                mapObject.set('title', ev.target.value);
                document.querySelector('.map-title').innerText = ev.target.value == '' ? 'タイトル未設定' : ev.target.value;
            });
            document.querySelector('#mapID').addEventListener('change', function(ev) {
                mapObject.set('mapID', ev.target.value);
                if (mapObject.get('status') == 'Update') {
                    mapObject.set('status', 'Change:' + mapID);
                }
            });
            document.querySelector('#attr').addEventListener('change', function(ev) {
                mapObject.set('attr', ev.target.value);
            });
            document.querySelector('#saveMap').addEventListener('click', function(ev) {
                if (!confirm('変更を保存します。\nよろしいですか?')) return;
                var saveValue = mapObject.attributes;
                if (saveValue.status.match(/^Change:(.+)$/) &&
                    confirm('地図IDが変更されています。コピーを行いますか?\nコピーの場合はOK、移動の場合はキャンセルを選んでください。')) {
                    saveValue.status = 'Copy:' + mapID;
                }
                document.body.style.pointerEvents = 'none';
                backend.save(saveValue);
                ipcRenderer.once('saveResult', function(event, arg) {
                    document.body.style.pointerEvents = null;
                    if (arg == 'Success') {
                        alert('正常に保存できました。');
                        mapObject.set('status', 'Update');
                        mapObject.setCurrentAsDefault();
                        document.querySelector('#saveMap').setAttribute('disabled', true);
                        if (mapID != mapObject.get('mapID')) {
                            mapID = mapObject.get('mapID');
                            backend.request(mapID);
                        }
                    } else if (arg == 'Exist') {
                        alert('地図IDが重複しています。\n地図IDを変更してください。');
                    } else {
                        console.log(arg);
                        alert('保存時エラーが発生しました。');
                    }
                });
            });
            document.querySelector('#changeID').addEventListener('click', function(ev) {
                if (!confirm('地図IDを変更してよろしいですか?')) return;
                document.querySelector('#mapID').removeAttribute('disabled');
                document.querySelector('#changeIDdiv').classList.add('hide');
                document.querySelector('#checkIDdiv').classList.remove('hide');
                mapObject.set('status', 'Change:' + mapID);
            });
            document.querySelector('#uploadMap').addEventListener('click', function(ev) {
                if (mapObject.gcpsEditReady() && !confirm('地図画像は既に登録されています。\n置き換えてよいですか?')) return;
                if (!uploader) {
                    uploader = require('electron').remote.require('../lib/mapupload');
                    uploader.init();
                    ipcRenderer.on('mapUploaded', function(event, arg) {
                        document.body.style.pointerEvents = null;
                        myModal.hide();
                        if (arg.err) {
                            if (err != 'Canceled') alert('地図アップロードでエラーが発生しました。');
                            return;
                        } else {
                            alert('正常に地図がアップロードできました。');
                        }
                        mapObject.set('width', arg.width);
                        mapObject.set('height', arg.height);
                        mapObject.set('url', arg.url);
                        reflectIllstMap();
                    });
                }
                document.body.style.pointerEvents = 'none';
                document.querySelector('div.modal-body > p').innerText = '地図アップロード中です。';
                myModal.show();
                uploader.showMapSelectDialog();
            });
        }

        function reflectIllstMap() {
            ol.source.HistMap.createAsync({
                mapID: mapID,
                url: mapObject.get('url'),
                width: mapObject.get('width'),
                height: mapObject.get('height'),
                attr: mapObject.get('attr'),
                noload: true
            },{})
                .then(function(source) {
                    illstSource = source;
                    illstMap.exchangeSource(illstSource);
                    var initialCenter = illstSource.xy2HistMapCoords([mapObject.get('width') / 2, mapObject.get('height') / 2]);
                    var illstView = illstMap.getView();
                    illstView.setCenter(initialCenter);

                    var gcps = mapObject.get('gcps');
                    if (gcps && gcps.length > 0) {
                        var center;
                        var zoom;
                        if (gcps.length == 1) {
                            center = gcps[0][1];
                            zoom = 16;
                        } else {
                            var results = gcps.reduce(function(prev, curr, index) {
                                var merc = curr[1];
                                prev[0][0] = prev[0][0] + merc[0];
                                prev[0][1] = prev[0][1] + merc[1];
                                if (merc[0] > prev[1][0]) prev[1][0] = merc[0];
                                if (merc[1] > prev[1][1]) prev[1][1] = merc[1];
                                if (merc[0] < prev[2][0]) prev[2][0] = merc[0];
                                if (merc[1] < prev[2][1]) prev[2][1] = merc[1];
                                if (index == gcps.length - 1) {
                                    var center = [prev[0][0]/gcps.length, prev[0][1]/gcps.length];
                                    var deltax = prev[1][0] - prev[2][0];
                                    var deltay = prev[1][1] - prev[2][1];
                                    var delta = deltax > deltay ? deltax : deltay;
                                    var zoom = Math.log(600 / 256 * ol.const.MERC_MAX * 2 / deltax) / Math.log(2);
                                    return [center, zoom];
                                } else return prev;
                            },[[0,0],[-1*ol.const.MERC_MAX,-1*ol.const.MERC_MAX],[ol.const.MERC_MAX,ol.const.MERC_MAX]]);
                        }
                        var mercView = mercMap.getView();
                        mercView.setCenter(results[0]);
                        mercView.setZoom(results[1]);

                        gcpsToMarkers(gcps);
                    }
                }).catch(function (err) {
                    console.log(err);
                });
        }

        var app = {};
        //マーカードラッグ用(Exampleよりコピペ)
        /**
         * @constructor
         * @extends {ol.interaction.Pointer}
         */
        app.Drag = function() {
            ol.interaction.Pointer.call(this, {
                handleDownEvent: app.Drag.prototype.handleDownEvent,
                handleDragEvent: app.Drag.prototype.handleDragEvent,
                handleMoveEvent: app.Drag.prototype.handleMoveEvent,
                handleUpEvent: app.Drag.prototype.handleUpEvent
            });

            /**
             * @type {ol.Pixel}
             * @private
             */
            this.coordinate_ = null;

            /**
             * @type {string|undefined}
             * @private
             */
            this.cursor_ = 'pointer';

            /**
             * @type {ol.Feature}
             * @private
             */
            this.feature_ = null;

            /**
             * @type {string|undefined}
             * @private
             */
            this.previousCursor_ = undefined;

            //マーカーレイヤのみ対象とするようにlayerFilterを設定
            this.layerFilter = 'MarkerLayer';

        };
        ol.inherits(app.Drag, ol.interaction.Pointer);

        /**
         * @param {ol.MapBrowserEvent} evt Map browser event.
         * @return {boolean} `true` to start the drag sequence.
         */
        app.Drag.prototype.handleDownEvent = function(evt) {
            var map = evt.map;

            var this_ = this;
            var feature = map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
                return feature;
            }, {}, function(layer) {
                return layer.get('name') == this_.layerFilter;
            });

            if (feature) {
                this.coordinate_ = evt.coordinate;
                this.feature_ = feature;
            }

            return !!feature;
        };

        /**
         * @param {ol.MapBrowserEvent} evt Map browser event.
         */
        app.Drag.prototype.handleDragEvent = function(evt) {
            var map = evt.map;

            var this_ = this;
            var feature = map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
                return feature;
            }, {}, function(layer) {
                return layer.get('name') == this_.layerFilter;
            });

            var deltaX = evt.coordinate[0] - this.coordinate_[0];
            var deltaY = evt.coordinate[1] - this.coordinate_[1];

            var geometry = /** @type {ol.geom.SimpleGeometry} */
                (this.feature_.getGeometry());
            geometry.translate(deltaX, deltaY);

            this.coordinate_[0] = evt.coordinate[0];
            this.coordinate_[1] = evt.coordinate[1];
        };

        /**
         * @param {ol.MapBrowserEvent} evt Event.
         */
        app.Drag.prototype.handleMoveEvent = function(evt) {
            var anotherMap = evt.map == illstMap ? mercMap : illstMap;
            anotherMap.closeContextMenu();
            if (this.cursor_) {
                var map = evt.map;

                var this_ = this;
                var feature = map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
                    return feature;
                }, {}, function(layer) {
                    return layer.get("name") == this_.layerFilter;
                });

                var element = evt.map.getTargetElement();
                if (feature) {
                    if (element.style.cursor != this.cursor_) {
                        this.previousCursor_ = element.style.cursor;
                        element.style.cursor = this.cursor_;
                    }
                } else if (this.previousCursor_ !== undefined) {
                    element.style.cursor = this.previousCursor_;
                    this.previousCursor_ = undefined;
                }
            }
        };

        /**
         * @param {ol.MapBrowserEvent} evt Map browser event.
         * @return {boolean} `false` to stop the drag sequence.
         */
        app.Drag.prototype.handleUpEvent = function(evt) {
            var map = evt.map;
            var isIllst = map == illstMap;
            var feature = this.feature_;
            var xy = feature.getGeometry().getCoordinates();
            xy = isIllst ? illstSource.histMapCoords2Xy(xy) : xy;

            var gcpIndex = feature.get('gcpIndex');
            if (gcpIndex != 'new') {
                var gcps = mapObject.get('gcps');
                gcps[gcpIndex][isIllst ? 0 : 1] = xy;
                mapObject.set('gcps', gcps);
                mapObject.trigger('change:gcps', mapObject, gcps);
                mapObject.trigger('change', mapObject);
            } else {
                newlyAddGcp[isIllst ? 0 : 1] = xy;
            }
            this.coordinate_ = null;
            this.feature_ = null;
            return false;
        };

        ol.MaplatMap.prototype.initContextMenu = function() {
            var normalContextMenu = {
                text: 'マーカー追加',
                //classname: 'some-style-class', // you can add this icon with a CSS class
                // instead of `icon` property (see next line)
                // icon: 'img/marker.png',  // this can be relative or absolute
                callback: this.addNewMarkerCallback
            };

            var removeContextMenu = {
                text: 'マーカー削除',
                // icon: 'img/marker.png',
                callback: this.removeMarkerCallback
            }

            var contextmenu = this.contextmenu = new ContextMenu({
                width: 170,
                defaultItems: false,
                items: [ normalContextMenu ]
            });
            this.addControl(contextmenu);
            var restore = false;

            contextmenu.on('open', function(evt){
                var feature = this.map_.forEachFeatureAtPixel(evt.pixel, function(ft, l){
                    return ft;
                });
                if (feature) {
                    contextmenu.clear();
                    removeContextMenu.data = {
                        marker: feature
                    };
                    contextmenu.push(removeContextMenu);
                    restore = true;
                } else if (restore) {
                    contextmenu.clear();
                    contextmenu.push(normalContextMenu);
                    //contextmenu.extend(contextmenu.getDefaultItems());
                    restore = false;
                }
            });

            this.on('unfocus',function() {
                console.log('unfocus');
            });
        };
        ol.MaplatMap.prototype.closeContextMenu = function() {
            this.contextmenu.close();
        };

        var illstMap = new ol.MaplatMap({
            div: 'illstMap',
            interactions: ol.interaction.defaults().extend([
                new ol.interaction.DragRotateAndZoom()
            ]),
            controls: ol.control.defaults()
        });
        illstMap.addNewMarkerCallback = addNewMarker;
        illstMap.removeMarkerCallback = removeMarker;
        illstMap.initContextMenu();
        var illstSource;

        var mapObject;
        if (mapID) {
            var mapIDElm = document.querySelector('#mapID');
            mapIDElm.value = mapID;
            mapIDElm.setAttribute('disabled', true);
            document.querySelector('#changeIDdiv').classList.remove('hide');
            document.querySelector('#checkIDdiv').classList.add('hide');
            backend.request(mapID);
        } else {
            mapObject = new Map({
                status: 'New'
            });
            document.querySelector('#changeIDdiv').classList.add('hide');
            document.querySelector('#checkIDdiv').classList.remove('hide');
            setEventListner(mapObject);
        }
        ipcRenderer.on('mapData', function(event, arg) {
            arg.mapID = mapID;
            arg.status = 'Update';
            mapObject = new Map(arg);
            setEventListner(mapObject);
            document.querySelector('#title').value = mapObject.get('title');
            document.querySelector('.map-title').innerText = mapObject.get('title');
            document.querySelector('#attr').value = mapObject.get('attr');
            document.querySelector('#width').value = mapObject.get('width');
            document.querySelector('#height').value = mapObject.get('height');
            reflectIllstMap();
        });
        illstMap.addInteraction(new app.Drag());

        var mercMap = new ol.MaplatMap({
            div: 'mercMap',
            interactions: ol.interaction.defaults().extend([
                new ol.interaction.DragRotateAndZoom({
                    condition: ol.events.condition.altKeyOnly
                })
            ]),
            controls: ol.control.defaults()
        });
        mercMap.addNewMarkerCallback = addNewMarker;
        mercMap.removeMarkerCallback = removeMarker;
        mercMap.initContextMenu();
        var mercSource;
        Promise.all([
            ol.source.HistMap.createAsync({
                mapID: 'gsimap',
                label: 'GSI Aerial Photo',
                attr: 'The Geospatial Information Authority of Japan',
                maptype: 'base',
                url: 'https://cyberjapandata.gsi.go.jp/xyz/ort/{z}/{x}/{y}.jpg',
                maxZoom: 18
            }, {})
                .then(function(source) {
                    return new ol.layer.Tile({
                        title: '地理院航空写真',
                        type: 'base',
                        visible: false,
                        source: source
                    });
                }),
            ol.source.HistMap.createAsync('gsi', {})
                .then(function(source) {
                    return new ol.layer.Tile({
                        title: '地理院地図',
                        type: 'base',
                        visible: false,
                        source: source
                    });
                }),
            ol.source.HistMap.createAsync('osm', {})
                .then(function(source) {
                    mercSource = source;
                    mercSource._map = mercMap;
                    return new ol.layer.Tile({
                        title: 'OpenStreetMap',
                        type: 'base',
                        visible: true,
                        source: source
                    });
                })
        ]).then(function(layers) {
            var layerGroup = new ol.layer.Group({
                'title': 'ベースマップ',
                layers: layers
            });
            var layers = mercMap.getLayers();
            layers.removeAt(0);
            layers.insertAt(0, layerGroup);

            var layerSwitcher = new ol.control.LayerSwitcher({});
            mercMap.addControl(layerSwitcher);
        });
        mercMap.addInteraction(new app.Drag());

        var geocoder = new Geocoder('nominatim', {
            provider: 'osm',
            lang: 'en-US', //en-US, fr-FR
            placeholder: '住所を指定してください',
            limit: 5,
            keepOpen: false
        });
        mercMap.addControl(geocoder);

        var switcher = new ol.control.LayerSwitcher();
        mercMap.addControl(switcher);

        var myModal = new bsn.Modal(document.getElementById('staticModal'), {});

        var myMapTab = document.querySelector('a[href="#gcpsTab"]');
        myMapTab.addEventListener('shown.bs.tab', function(event) {
            illstMap.updateSize();
            mercMap.updateSize();
        });
    });
