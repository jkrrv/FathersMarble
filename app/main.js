/*global require*/
/*eslint-env node*/
'use strict';

require.config({
    // baseUrl : 'node_modules/cesium/Build/Cesium',
    baseUrl : 'node_modules/cesium/Source', // KURTZ switch to minified build eventually.
    waitSeconds : 60
});


requirejs(['Cesium'], function(Cesium) {

    /**
     * The Pile class represents the collection of all peoples in a given place.
     *
     * @param geoPeoples
     * @constructor
     */
    var Pile = function(geoPeoples) {
        this.peoples = geoPeoples;
    };

    /**
     * Constants to specify the means by which the height should be calculated.
     */
    Pile.heightFormat = {

        /** JPS: Joshua Project Status : The classifications assigned by The Joshua Project. Reached, Minimally/Superficially Reached, Partially/Significantly Reached **/
        JPS: 1,

        /** PROFESS: Professed faith : A classification based on reported profession.  Evangelical, Christian, Non-Christian */
        PROFESS: 2
    };

    /**
     * Calculate the heights of bars for a given Pile.
     *
     * @param format
     * @returns {{r: number, y: number, g: number, sum: number}}
     */
    Pile.prototype.calcHeights = function(format) {
        var out = {
            r: 0,
            o: 0,
            y: 0,
            s: 0,
            g: 0,
            sum: 0
        };

        var index, people;
        switch(format) {
            case Pile.heightFormat.JPS : {
                for(index in this.peoples) {
                    if (this.peoples.hasOwnProperty(index)) {
                        people = this.peoples[index];

                        if (people.jps < 2) {
                            out.r += people.pop;
                        } else if (people.jps < 3) {
                            out.o += people.pop;
                        } else if (people.jps < 4) {
                            out.y += people.pop;
                        } else if (people.jps < 5) {
                            out.s += people.pop;
                        } else {
                            out.g += people.pop;
                        }
                    }
                }
            } break;
            case Pile.heightFormat.PROFESS : {
                for(index in this.peoples) {
                    if (this.peoples.hasOwnProperty(index)) {
                        people = this.peoples[index];
                        out.g += (people.evn * people.pop);
                        out.y += Math.max((people.adh - people.evn) * people.pop, 0);
                        out.r += (1 - people.adh) * people.pop;

                        if (people.jps < 2) {
                            out.r += people.pop;
                        } else if (people.jps < 3) {
                            out.y += people.pop;
                        } else {
                            out.g += people.pop;
                        }
                    }
                }
            } break;
        }
        out.sum = out.r + out.y + out.g;
        return out;
    };


    Pile.prototype.putDescription = function(whereToPutDescription, property) {
        console.log(this.peoples);

        var description = document.createDocumentFragment();


        for (const peopleId in this.peoples) {
            if (this.peoples.hasOwnProperty(peopleId)) {
                var peopleDiv = document.createElement('div');
                peopleDiv.innerHTML = "<h2>" + peopleId + "</h2>";
                description.appendChild(peopleDiv);
            }
        }


        whereToPutDescription.description = description.innerHTML;
    };


    /**
     * This class is very closely modeled after the Cesium Data Source example of the same name.  It represents the
     * collection of data to Cesium.
     *
     * @alias WebGLGlobeDataSource
     * @constructor
     *
     * @param {String} [name] The name of this data source.  If undefined, a name
     *                        will be derived from the url.
     *
     * @example
     * var dataSource = new Cesium.WebGLGlobeDataSource();
     * dataSource.loadUrl('sample.json');
     * viewer.dataSources.add(dataSource);
     */
    function WebGLGlobeDataSource(name) {
        //All public configuration is defined as ES5 properties
        //These are just the "private" variables and their defaults.
        this._name = name;
        this._changed = new Cesium.Event();
        this._error = new Cesium.Event();
        this._isLoading = false;
        this._loading = new Cesium.Event();
        this._entityCollection = new Cesium.EntityCollection();
        this._seriesNames = [];
        this._seriesToDisplay = undefined;
        this._heightScale = 2;
        this._widthScale = 20000;
        this._entityCluster = new Cesium.EntityCluster();
    }

    Object.defineProperties(WebGLGlobeDataSource.prototype, {
        //The below properties must be implemented by all DataSource instances
        /**
         * Gets a human-readable name for this instance.
         * @memberOf WebGLGlobeDataSource.prototype
         * @type {String}
         */
        name : {
            get : function() {
                return this._name;
            }
        },
        /**
         * Since WebGL Globe JSON is not time-dynamic, this property is always undefined.
         * @memberOf WebGLGlobeDataSource.prototype
         * @type {DataSourceClock}
         */
        clock : {
            value : undefined,
            writable : false
        },
        /**
         * Gets the collection of Entity instances.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {EntityCollection}
         */
        entities : {
            get : function() {
                return this._entityCollection;
            }
        },
        /**
         * Gets a value indicating if the data source is currently loading data.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Boolean}
         */
        isLoading : {
            get : function() {
                return this._isLoading;
            }
        },
        /**
         * Gets an event that will be raised when the underlying data changes.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Event}
         */
        changedEvent : {
            get : function() {
                return this._changed;
            }
        },
        /**
         * Gets an event that will be raised if an error is encountered during
         * processing.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Event}
         */
        errorEvent : {
            get : function() {
                return this._error;
            }
        },
        /**
         * Gets an event that will be raised when the data source either starts or
         * stops loading.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Event}
         */
        loadingEvent : {
            get : function() {
                return this._loading;
            }
        },
        //These properties are specific to this DataSource.
        /**
         * Gets the array of series names.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {String[]}
         */
        seriesNames : {
            get : function() {
                return this._seriesNames;
            }
        },
        /**
         * Gets or sets the name of the series to display.  WebGL JSON is designed
         * so that only one series is viewed at a time.  Valid values are defined
         * in the seriesNames property.
         * @memberOf WebGLGlobeDataSource.prototype
         * @type {String}
         */
        seriesToDisplay : {
            get : function() {
                return this._seriesToDisplay;
            },
            set : function(value) {
                this._seriesToDisplay = value;
                //Iterate over all entities and set their show property
                //to true only if they are part of the current series.
                var collection = this._entityCollection;
                var entities = collection.values;
                collection.suspendEvents();
                for (var i = 0; i < entities.length; i++) {
                    var entity = entities[i];
                    entity.show = value === entity.seriesName;
                }
                collection.resumeEvents();
            }
        },
        /**
         * Gets or sets the scale factor applied to the height of each line.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Number}
         */
        heightScale : {
            get : function() {
                return this._heightScale;
            },
            set : function(value) {
                if (value > 0) {
                    throw new Cesium.DeveloperError('value must be greater than 0');
                }
                this._heightScale = value;
            }
        },
        /**
         * Gets whether or not this data source should be displayed.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Boolean}
         */
        show : {
            get : function() {
                return this._entityCollection;
            },
            set : function(value) {
                this._entityCollection = value;
            }
        },
        /**
         * Gets or sets the clustering options for this data source. This object can be shared between multiple data sources.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {EntityCluster}
         */
        clustering : {
            get : function() {
                return this._entityCluster;
            },
            set : function(value) {
                if (!Cesium.defined(value)) {
                    throw new Cesium.DeveloperError('value must be defined.');
                }
                this._entityCluster = value;
            }
        }
    });

    /**
     * Asynchronously loads the GeoJSON at the provided url, replacing any existing data.
     * @param {Object} url The url to be processed.
     * @returns {Promise} a promise that will resolve when the GeoJSON is loaded.
     */
    WebGLGlobeDataSource.prototype.loadUrl = function(url) {
        if (!Cesium.defined(url)) {
            throw new Cesium.DeveloperError('url is required.');
        }
        //Create a name based on the url
        var name = Cesium.getFilenameFromUri(url);
        //Set the name if it is different than the current name.
        if (this._name !== name) {
            this._name = name;
            this._changed.raiseEvent(this);
        }
        //Use 'when' to load the URL into a json object
        //and then process is with the `load` function.
        var that = this;
        return Cesium.when(Cesium.loadJson(url), function(json) {
            return that.load(json);
        }).otherwise(function(error) {
            //Otherwise will catch any errors or exceptions that occur
            //during the promise processing. When this happens,
            //we raise the error event and reject the promise.
            this._setLoading(false);
            that._error.raiseEvent(that, error);
            return Cesium.when.reject(error);
        });
    };

    /**
     * Loads the provided data, replacing any existing data.
     * @param {Object} data The object to be processed.
     */
    WebGLGlobeDataSource.prototype.load = function(data) {
        //>>includeStart('debug', pragmas.debug);
        if (!Cesium.defined(data)) {
            throw new Cesium.DeveloperError('data is required.');
        }
        //>>includeEnd('debug');

        //Clear out any data that might already exist.
        this._setLoading(true);
        this._seriesNames.length = 0;
        this._seriesToDisplay = undefined;

        var heightScale = this._heightScale;
        var widthScale = parseInt(this._widthScale);
        var slices = 8;
        var entities = this._entityCollection;

        //It's a good idea to suspend events when making changes to a
        //large amount of entities.  This will cause events to be batched up
        //into the minimal amount of function calls and all take place at the
        //end of processing (when resumeEvents is called).
        entities.suspendEvents();
        entities.removeAll();

        var h=0; // count the number of cylinders generated.

        // Loop over each geographic point
        for (var x = 0; x < data.length; x++) {

            var geo = data[x];
            var latitude = parseInt(geo.lat);
            var longitude = parseInt(geo.lng);

            piles[x] = new Pile(geo.peoples);

            // TODO make calculation selection a dynamic feature
            var heights = piles[x].calcHeights(Pile.heightFormat.JPS);
            // var heights = peoples.calcHeights(Pile.heightFormat.PROFESS);

            // TODO break this into more functions so things are more readily callable when user options are made available.

            // Calculate heights for each colored bar
            heights.g = heights.g >> heightScale;
            heights.s = heights.s >> heightScale;
            heights.y = heights.y >> heightScale;
            heights.o = heights.o >> heightScale;
            heights.r = heights.r >> heightScale;


            // Create Green Bar
            if (heights.g > 1) {
                entities.add(new Cesium.Entity({
                    id : "g " + x.toString(),
                    show : true,
                    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, heights.g/2),
                    cylinder: {
                        length: heights.g,
                        topRadius: parseInt(widthScale),
                        slices: slices,
                        bottomRadius: parseInt(widthScale),
                        material: Cesium.Color.GREEN.withAlpha(.6)
                    },
                    seriesName : "g"
                }));

                h++;
            }

            // Create "SpringGreeen" bar
            if (heights.s > 1) {
                entities.add(new Cesium.Entity({
                    id : "s " + x.toString(),
                    show : true,
                    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, heights.g + (heights.s/2)),
                    cylinder: {
                        length: heights.s,
                        topRadius: parseInt(widthScale),
                        slices: slices,
                        bottomRadius: parseInt(widthScale),
                        material: Cesium.Color.GREENYELLOW.withAlpha(.6)
                    },
                    seriesName : "s"
                }));

                h++;
            }

            // Create Yellow bar
            if (heights.y > 1) {
                entities.add(new Cesium.Entity({
                    id : "y " + x.toString(),
                    show : true,
                    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, heights.g + heights.s + (heights.y/2)),
                    cylinder: {
                        length: heights.y,
                        topRadius: parseInt(widthScale),
                        slices: slices,
                        bottomRadius: parseInt(widthScale),
                        material: Cesium.Color.YELLOW.withAlpha(.6)
                    },
                    seriesName : "y"
                }));

                h++;
            }

            // Create Orange bar
            if (heights.o > 1) {
                entities.add(new Cesium.Entity({
                    id : "o " + x.toString(),
                    show : true,
                    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, heights.g + heights.s + heights.y + (heights.o/2)),
                    cylinder: {
                        length: heights.o,
                        topRadius: parseInt(widthScale),
                        slices: slices,
                        bottomRadius: parseInt(widthScale),
                        material: Cesium.Color.ORANGE.withAlpha(.6)
                    },
                    seriesName : "o"
                }));

                h++;
            }

            // Create Red bar
            if (heights.r > 1) {
                entities.add(new Cesium.Entity({
                    id : "r " + x.toString(),
                    description: "this is a desc",
                    show : true,
                    position: Cesium.Cartesian3.fromDegrees(longitude, latitude, heights.g + heights.s + heights.y + heights.o + (heights.r/2)),
                    cylinder: {
                        length: heights.r,
                        topRadius: parseInt(widthScale),
                        slices: slices,
                        bottomRadius: parseInt(widthScale),
                        material: Cesium.Color.RED.withAlpha(.6)
                    },
                    seriesName : "r"
                }));

                h++;
            }
        }

        window.console.log("cylinders:", h);

        // Once all data is processed, call resumeEvents and raise the changed event so the display can update.
        entities.resumeEvents();
        this._changed.raiseEvent(this);
        this._setLoading(false);
    };


    WebGLGlobeDataSource.prototype._setLoading = function(isLoading) {
        if (this._isLoading !== isLoading) {
            this._isLoading = isLoading;
            this._loading.raiseEvent(this, isLoading);
        }
    };


    // Instantiate the Data Source and load the data.
    var dataSource = new WebGLGlobeDataSource();
    dataSource.loadUrl('data/geo.json').then(function() {

        // TODO UI Option population

    });

    Cesium.BingMapsApi.defaultKey =  'AjUK0-UaaYujmmlMT2iXlFADNDnttZM4F5ADqiCfdP-y_JojoP8089gU-nzdGhNe';

//Create a Viewer instances and add the DataSource.
    var viewer = new Cesium.Viewer('cesiumContainer', {
        animation : false,
        baseLayerPicker : false,
        fullscreenButton: false, // wil be manually created later, to put it into the toolbar
        geocoder : false,
        infoBox: true,
        navigationInstructionsInitiallyVisible: false,
        imageryProvider: new Cesium.BingMapsImageryProvider({
            url : '//dev.virtualearth.net'
        }),
        skyAtmosphere: false,
        skyBox: false,
        timeline : false,
        scene: {
            globe: {
                enableLighting: true
            }
        }
    });

    viewer.infoBox.frame.sandbox = "allow-same-origin allow-top-navigation allow-pointer-lock allow-popups allow-forms allow-scripts";

    // Prevent camera from getting locked to entity via double-click
    viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(function() {}, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // make selections switch to the intended entity, instead of the actually-clicked entity.
    viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(function(movement) {
        var clickedOn = viewer.scene.pick(movement.position),
            clickedEntity = (Cesium.defined(clickedOn)) ? clickedOn.id : undefined;
        if (Cesium.defined(clickedEntity) && Cesium.defined(clickedEntity.cylinder)) {

            //TODO select the representative entity here.
            viewer.selectedEntity = handleSelection(clickedEntity);

            // clickedEntity.cylinder.material = Cesium.Color.WHITE.withAlpha(0.9);
        } else {
            viewer.selectedEntity = undefined;
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // var handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    // handler.setInputAction(function(movement) {
    //     var pickedPrimitive = viewer.scene.pick(movement.endPosition);
    //     var pickedEntity = (Cesium.defined(pickedPrimitive)) ? pickedPrimitive.id : undefined;
    //     // Highlight the currently picked entity
    //     if (Cesium.defined(pickedEntity) && Cesium.defined(pickedEntity.billboard)) {
    //         pickedEntity.billboard.scale = 2.0;
    //         pickedEntity.billboard.color = Cesium.Color.ORANGERED;
    //     }
    // }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    viewer.scene.globe.enableLighting = true;

    new Cesium.FullscreenButton(viewer._toolbar);

    var imageryLayers = viewer.imageryLayers;
    // if (imageryLayers.length > 0) {
    //     var layer = imageryLayers.get(0);
    //     layer.saturation = 0;
    //     layer.contrast = 2;
    //     layer.brightness = 0.8;
    // }
    if (imageryLayers.length > 0) { // bing
        var layer = imageryLayers.get(0);
        layer.saturation = 0;
        layer.contrast = 1.8;
        layer.brightness = 0.8;
    }

    // if (imageryLayers.length > 0) { // black marble
    //     var layer = imageryLayers.get(0);
    //     layer.saturation = 0;
    //     // layer.contrast = 1.8;
    //     // layer.brightness = 0.8;
    // }

    viewer.dataSources.add(dataSource).then(function() {
        document.getElementById('loadingOverlay').style.opacity = '0';
        setTimeout(function () {
            document.getElementById('loadingOverlay').style.display = 'none';
        }, 10000)
    });

    // Add credit footnote for Joshua Project
    var jpCredit = new Cesium.Credit('Joshua Project', 'assets/jp_logo_color.png', 'https://joshuaproject.net'),
        nasaCredit = new Cesium.Credit('NASA Socioeconomic Data and Applications Center (SEDAC)', 'assets/nasa-logo.svg', 'http://sedac.ciesin.columbia.edu/data/collection/gpw-v4');
    viewer.scene.frameState.creditDisplay.addDefaultCredit(jpCredit);
    viewer.scene.frameState.creditDisplay.addDefaultCredit(nasaCredit);


    var describedEntities = [],
        now = Cesium.JulianDate.now(),
        piles = [];

    function handleSelection(selectedEntity) {
        var pileId = parseInt(selectedEntity.id.split(' ', 2)[1]);

        if (describedEntities[pileId] === undefined) {
            var position = selectedEntity.position.getValue(now);
            position = Cesium.Cartographic.fromCartesian(position);
            describedEntities[pileId] = new Cesium.Entity({
                id : "DE " + pileId.toString(),
                show : true,
                position: Cesium.Cartesian3.fromRadians(position.longitude, position.latitude, 0),
                seriesName : "DE"
            });

            describedEntities[pileId].description = "<i class='loading'>Loading...</i>";

            piles[pileId].putDescription(describedEntities[pileId], 'description');
        }

        return describedEntities[pileId];
    }
});

var v;