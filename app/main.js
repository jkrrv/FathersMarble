// require.config({
//     baseUrl : 'node_modules/cesium/Build/Cesium',
//     // baseUrl : 'node_modules/cesium/Source', // KURTZ switch to minified build eventually.
//     waitSeconds : 60
// });





/**
 * The PileVillage represents the portion of a Village within a Pile.
 *
 * @class
 * @param villageId
 * @param geoVillage
 * @constructor
 */
let PileVillage = function(villageId, geoVillage) {
    this.countryCode = villageId.substr(0, 2);
    this.villageId = villageId;
    this.peopleId = villageId.substr(2);
    this.population = geoVillage.pop;
    this.jpScale = geoVillage.jps;
    this.adherants = geoVillage.adh;
    this.evangelicals = geoVillage.evn;
};
Object.defineProperties(PileVillage.prototype, {
    v : {
        get : function() {
            return Village.getVillage(this);
        }
    }
});

/**
 * The Pile class represents a vertical bar on the earth.
 *
 * @param geoVillages
 * @param pileId
 * @constructor
 */
let Pile = function(geoVillages, pileId) {
    /** @property {PileVillage[]} villages */
    this.pileVillages = [];
    this._pileVillagesByCountry = [];
    this._pileId = pileId;

    for (const vi in geoVillages) {
        if (!geoVillages.hasOwnProperty(vi))
            continue;

        this.pileVillages[vi] = new PileVillage(vi, geoVillages[vi]);
    }
};

Pile._countries = {};
Pile.setCountries = function(countryObject) {
    Pile._countries = countryObject;
};
Pile.getCountry = function(countryCode) {
    return Pile._countries[countryCode];
};

/**
 *
 * @param {string} [countryCode=null] The code of the country to return if only one is desired.
 * @returns {PileVillage|PileVillage[]}
 */
Pile.prototype.getPileVillagesByCountry = function(countryCode) {
    if (this._pileVillagesByCountry.length === 0) {
        this._pileVillagesByCountry.length = 0;
        for (const vi in this.pileVillages) {
            if (this._pileVillagesByCountry[this.pileVillages[vi].countryCode] === undefined) {
                this._pileVillagesByCountry[this.pileVillages[vi].countryCode] = [];
                this._pileVillagesByCountry.length++;
            }

            this._pileVillagesByCountry[this.pileVillages[vi].countryCode].push(this.pileVillages[vi]);
        }
    }
    if (countryCode === undefined)
        return this._pileVillagesByCountry;
    if (this._pileVillagesByCountry[countryCode] === undefined)
        return [];
    return this._pileVillagesByCountry[countryCode];
};


/**
 *
 * @returns {string}
 */
Pile.prototype.getName = function() {
    let vsByC = this.getPileVillagesByCountry(),
        cs = [];
    for (const cc in vsByC) {
        if (!vsByC.hasOwnProperty(cc))
            continue;
        cs.push(Pile.getCountry(cc));
    }
    let last = cs.pop();
    if (cs.length > 0) {
        return cs.join(', ') + ' & ' + last;
    }
    return last;
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

Pile.colorMeanings = {
    1: {
        'r' : "Unreached",
        'o' : "Minimally Reached",
        'y' : "Superficially Reached",
        's' : "Partially Reached",
        'g' : "Significantly Reached"
    },
    2: {
        'r' : "Non-Christian",
        'y' : "Christian",
        'g' : "Evangelical"
    }
};

/**
 * Calculate the heights of bars for a given Pile.
 *
 * @param format
 * @returns {{r: number, y: number, g: number, sum: number}}
 */
Pile.prototype.calcHeights = function(format) {
    let out = {
        r: 0,
        o: 0,
        y: 0,
        s: 0,
        g: 0,
        sum: 0
    };

    let index, v;
    switch(format) {
        case Pile.heightFormat.JPS : {
            for(index in this.pileVillages) {
                if (this.pileVillages.hasOwnProperty(index)) {
                    v = this.pileVillages[index];

                    if (v.jpScale < 2) {
                        out.r += v.population;
                    } else if (v.jpScale < 3) {
                        out.o += v.population;
                    } else if (v.jpScale < 4) {
                        out.y += v.population;
                    } else if (v.jpScale < 5) {
                        out.s += v.population;
                    } else {
                        out.g += v.population;
                    }
                }
            }
        } break;
        case Pile.heightFormat.PROFESS : {
            for(index in this.pileVillages) {
                if (this.pileVillages.hasOwnProperty(index)) {
                    v = this.pileVillages[index];
                    out.g += v.evangelicals;
                    out.y += v.adherants;
                    out.r += v.population - v.adherants;
                }
            }
        } break;
    }
    out.sum = out.r + out.o + out.y + out.s + out.g;
    return out;
};


Pile.prototype.calcDescWidths = function(format) {
    let out = this.calcHeights(format),
        sum = 0;

    for (const color in out) {
        if (color === 'sum')
            continue;

        let current = Math.min(Math.round(out[color] / out.sum * 100), 100-sum);
        sum += current;

        out[color] = current.toString() + "%";
    }

    return out;
};

Pile.prototype.getColorBar = function(format, whereToPut) {
    let colorSizes = this.calcDescWidths(format),
        colorOrder = ["g", "s", "y", "o", "r"],
        bar = viewer.infoBox.frame.contentDocument.createElement('span');
        bar.classList.add("colorBar");

    for (let ci = 0; ci < colorOrder.length; ci++) {
        let c = colorOrder[ci],
            span = viewer.infoBox.frame.contentDocument.createElement('span');

        if (colorSizes[c] !== "0%") {

            span.classList.add("colorBar-color-" + c);
            span.classList.add("colorBar-format-" + format);
            span.style.width = colorSizes[c];

            span.innerHTML = Pile.colorMeanings[format][c];
            span.setAttribute('title', Pile.colorMeanings[format][c]);

            bar.appendChild(span);
        }
    }

    if (whereToPut !== undefined)
        whereToPut.appendChild(bar);

    return bar;

};


/**
 * The Currently-selected Pile.
 * @type {Pile}
 * @private
 */
Pile._currentPile = null;


Pile.handleSelection = function(selectedEntity) {
    if (selectedEntity === null) {
        Pile._currentPile = null;
        return null;
    }

    let pileId = parseInt(selectedEntity.id.split(' ', 2)[1]);

    if (describedEntities[pileId] === undefined) {
        let position = selectedEntity.position.getValue(now);
        position = Cesium.Cartographic.fromCartesian(position);
        describedEntities[pileId] = new Cesium.Entity({
            id : "DE-" + pileId.toString(),
            name: piles[pileId].getName(),
            show : true,
            position: Cesium.Cartesian3.fromRadians(position.longitude, position.latitude, 0),
            seriesName : "DE"
        });

        describedEntities[pileId].description = "<i class='loading'>Loading...</i>";


    }

    Pile._currentPile = piles[pileId];

    Pile.updateCurrentPileDescription();

    return describedEntities[pileId];
};


Pile.updateCurrentPileDescription = function() {
    if (Pile._currentPile === null)
        return false;

    Pile._currentPile.updateDescription();
};


Pile.prototype.updateDescription = function() {
    let description = viewer.infoBox.frame.contentDocument.createElement('div');

    this.appendHeaderTable(description);

    let countries = this.getPileVillagesByCountry();

    for (const co in countries) {
        let target;
        if (countries.length > 1) {
            target = viewer.infoBox.frame.contentDocument.createElement('div');
            target.classList.add("country");
            target.innerHTML = "<h2>" + Pile.getCountry(co) + "</h2>";
            description.appendChild(target);
        } else {
            target = description;
        }

        for (let pvi in countries[co]) {
            countries[co][pvi].v.putDescription(target);
        }
    }

    describedEntities[this._pileId].description = description.innerHTML;
};

Pile.prototype.appendHeaderTable = function(toWhat) {
    let headerTable = viewer.infoBox.frame.contentDocument.createElement('table'),
        colorBars = [
            {
                label: "Progress:",
                format: Pile.heightFormat.JPS,
                title: "The Progress Scale is an estimate of the progress of Church Planing among a people or peoples."
            },
            {
                label: "Profession:",
                format: Pile.heightFormat.PROFESS
            }
        ];

    for (const cbi in colorBars) {
        if (!colorBars.hasOwnProperty(cbi))
            continue;

        let row = viewer.infoBox.frame.contentDocument.createElement('tr'),
            labelCell = viewer.infoBox.frame.contentDocument.createElement('th'),
            barCell = viewer.infoBox.frame.contentDocument.createElement('td');

        // label cell
        row.appendChild(labelCell);
        labelCell.innerHTML = colorBars[cbi].label;

        // title for label
        if (colorBars[cbi].title !== undefined) {
            labelCell.setAttribute('title', colorBars[cbi].title);
            labelCell.classList.add('help-cursor');
        }

        // color bar cell
        row.appendChild(barCell);
        this.getColorBar(colorBars[cbi].format, barCell);

        headerTable.appendChild(row);
    }

    toWhat.appendChild(headerTable);
};


function Village(villageId) {
    if (Village._villages[villageId] !== undefined) {
        throw new Error("Villages must only be instantiated via the Village.getVillage method. ");
    }

    this.id = villageId;
    this.description = viewer.infoBox.frame.contentDocument.createElement('div');

    Village._villages[villageId] = this;
}
Object.defineProperties(Village.prototype, {
    joshuaProjectURL : {
        get : function() {
            return this.peopleId.toString(); // TODO fix this.
        }
    }
});

Village._villages = {};
Village._villagesQueuedForXHR = [];
Village._xhrTimeout = null;

Village.getVillage = function(pileVillageObjectOrVillageId) {
    let villageId = null;
    if (typeof pileVillageObjectOrVillageId === 'object')
        villageId = pileVillageObjectOrVillageId.villageId;
    else
        villageId = pileVillageObjectOrVillageId;
    if (Village._villages[villageId] === undefined)
        return new Village(villageId);
    return Village._villages[villageId]
};

Village.prototype.putDescription = function(whereToPutDescription) {
    if (this.description.innerHTML === '')
        this.queueLoadingOfVillageData();
    whereToPutDescription.appendChild(this.description);
};


Village.prototype.queueLoadingOfVillageData = function() {
    if (Village._villagesQueuedForXHR.indexOf(this.id) < 0)
        Village._villagesQueuedForXHR.push(this.id);

    if (Village._xhrTimeout !== null) {
        clearTimeout(Village._xhrTimeout);
    }
    Village._xhrTimeout = setTimeout(Village.sendXHR, 50);

};


Village.sendXHR = function() {
    let villages = Village._villagesQueuedForXHR,
        XHR = new XMLHttpRequest();
    Village._villagesQueuedForXHR = [];

    if (villages.length < 1)
        return;

    villages = villages.join(',');

    XHR.addEventListener("load", Village.xhrHandler);
    XHR.open("GET", "data/?v=" + villages);
    XHR.send();
};

Village.xhrHandler = function() {
    let data = JSON.parse(this.responseText);
    for (const vid in data) {
        Village.getVillage(vid).xhrHandler(data[vid]);
    }
    Pile.updateCurrentPileDescription();
};

Village.prototype.xhrHandler = function(data) {
    this.description.innerHTML = data.nameLcl; // TODO replace with a description assembler.
};


/**
 * @alias MarbleDataSource
 * @constructor
 *
 * @param {String} [name] The name of this data source.  If undefined, a name
 *                        will be derived from the url.
 *
 * @example
 * let dataSource = new Cesium.MarbleDataSource();
 * dataSource.loadUrl('sample.json');
 * viewer.dataSources.add(dataSource);
 */
function MarbleDataSource(name) {
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

Object.defineProperties(MarbleDataSource.prototype, {
    //The below properties must be implemented by all DataSource instances
    /**
     * Gets a human-readable name for this instance.
     * @memberOf MarbleDataSource.prototype
     * @type {String}
     */
    name : {
        get : function() {
            return this._name;
        }
    },
    /**
     * Since not time-dynamic, always undefined.
     * @memberOf MarbleDataSource.prototype
     * @type {DataSourceClock}
     */
    clock : {
        value : undefined,
        writable : false
    },
    /**
     * Gets the collection of Entity instances.
     * @memberof MarbleDataSource.prototype
     * @type {EntityCollection}
     */
    entities : {
        get : function() {
            return this._entityCollection;
        }
    },
    /**
     * Gets a value indicating if the data source is currently loading data.
     * @memberof MarbleDataSource.prototype
     * @type {Boolean}
     */
    isLoading : {
        get : function() {
            return this._isLoading;
        }
    },
    /**
     * Gets an event that will be raised when the underlying data changes.
     * @memberOf MarbleDataSource.prototype
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
     * @memberOf MarbleDataSource.prototype
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
     * @memberOf MarbleDataSource.prototype
     * @type {Event}
     */
    loadingEvent : {
        get : function() {
            return this._loading;
        }
    },
    /**
     * Gets the array of series names.
     * @memberOf MarbleDataSource.prototype
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
     * @memberOf MarbleDataSource.prototype
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
            let collection = this._entityCollection;
            let entities = collection.values;
            collection.suspendEvents();
            for (let i = 0; i < entities.length; i++) {
                let entity = entities[i];
                entity.show = value === entity.seriesName;
            }
            collection.resumeEvents();
        }
    },
    /**
     * Gets or sets the scale factor applied to the height of each line.
     * @memberOf MarbleDataSource.prototype
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
     * @memberOf MarbleDataSource.prototype
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
     * @memberOf MarbleDataSource.prototype
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
MarbleDataSource.prototype.loadUrl = function(url) {
    if (!Cesium.defined(url)) {
        throw new Cesium.DeveloperError('url is required.');
    }
    //Create a name based on the url
    let name = Cesium.getFilenameFromUri(url);
    //Set the name if it is different than the current name.
    if (this._name !== name) {
        this._name = name;
        this._changed.raiseEvent(this);
    }
    let that = this;
    return Cesium.Resource.fetchJson(url)
        .then(function (json) {
            return that.load(json, url);
        })
        .otherwise(function (error) {
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
MarbleDataSource.prototype.load = function(data) {
    //>>includeStart('debug', pragmas.debug);
    if (!Cesium.defined(data)) {
        throw new Cesium.DeveloperError('data is required.');
    }
    //>>includeEnd('debug');

    //Clear out any data that might already exist.
    this._setLoading(true);
    this._seriesNames.length = 0;
    this._seriesToDisplay = undefined;

    let heightScale = this._heightScale;
    let widthScale = parseInt(this._widthScale);
    let slices = 8;
    let entities = this._entityCollection;

    //It's a good idea to suspend events when making changes to a
    //large amount of entities.  This will cause events to be batched up
    //into the minimal amount of function calls and all take place at the
    //end of processing (when resumeEvents is called).
    entities.suspendEvents();
    entities.removeAll();

    Pile.setCountries(data.ctry);
    let gridData = data.grid;

    let h=0; // count the number of cylinders generated.

    // Loop over each geographic point
    for (let x = 0; x < gridData.length; x++) {

        let geo = gridData[x];
        let latitude = parseInt(geo.lat);
        let longitude = parseInt(geo.lng);

        piles[x] = new Pile(geo.v, x);

        // TODO make calculation selection a dynamic feature
        let heights = piles[x].calcHeights(Pile.heightFormat.JPS);

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


MarbleDataSource.prototype._setLoading = function(isLoading) {
    if (this._isLoading !== isLoading) {
        this._isLoading = isLoading;
        this._loading.raiseEvent(this, isLoading);
    }
};


// Instantiate the Data Source and load the data.
let dataSource = new MarbleDataSource();
dataSource.loadUrl('data/geo.json').then(function() {

    // TODO UI Option population

});

//Create a Viewer instances and add the DataSource.
let viewer = new Cesium.Viewer('cesiumContainer', {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false, // will be manually created later, to put it into the toolbar
    geocoder: false,
    infoBox: true,
    navigationInstructionsInitiallyVisible: false,
    imageryProvider: new Cesium.BingMapsImageryProvider({
        url : '//dev.virtualearth.net',
        key: 'AjUK0-UaaYujmmlMT2iXlFADNDnttZM4F5ADqiCfdP-y_JojoP8089gU-nzdGhNe'
    }),
    skyBox: false,
    timeline: false,
});

viewer.infoBox.frame.sandbox = "allow-same-origin allow-top-navigation allow-pointer-lock allow-popups allow-forms allow-scripts";
viewer.infoBox.viewModel.enableCamera = false;

// Prevent camera from getting locked to entity via double-click
viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(function() {}, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

// make selections switch to the intended entity, instead of the actually-clicked entity.
viewer.cesiumWidget.screenSpaceEventHandler.setInputAction(function(movement) {
    let clickedOn = viewer.scene.pick(movement.position),
        clickedEntity = (Cesium.defined(clickedOn)) ? clickedOn.id : undefined;
    if (Cesium.defined(clickedEntity) && Cesium.defined(clickedEntity.cylinder)) {

        viewer.selectedEntity = Pile.handleSelection(clickedEntity);

        // clickedEntity.cylinder.material = Cesium.Color.WHITE.withAlpha(0.9);
    } else {
        viewer.selectedEntity = undefined;
        Pile.handleSelection(null);
    }
}, Cesium.ScreenSpaceEventType.LEFT_CLICK);

// let handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
// handler.setInputAction(function(movement) {
//     let pickedPrimitive = viewer.scene.pick(movement.endPosition);
//     let pickedEntity = (Cesium.defined(pickedPrimitive)) ? pickedPrimitive.id : undefined;
//     // Highlight the currently picked entity
//     if (Cesium.defined(pickedEntity) && Cesium.defined(pickedEntity.billboard)) {
//         pickedEntity.billboard.scale = 2.0;
//         pickedEntity.billboard.color = Cesium.Color.ORANGERED;
//     }
// }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

viewer.scene.skyAtmosphere.show = false;
viewer.scene.globe.enableLighting = false;
viewer.scene.globe.showGroundAtmosphere = false;

new Cesium.FullscreenButton(viewer._toolbar);

let imageryLayers = viewer.imageryLayers;
// if (imageryLayers.length > 0) {
//     let layer = imageryLayers.get(0);
//     layer.saturation = 0;
//     layer.contrast = 2;
//     layer.brightness = 0.8;
// }
if (imageryLayers.length > 0) { // bing
    let layer = imageryLayers.get(0);
    layer.saturation = 0;
    layer.contrast = 1.9;
    layer.brightness = 0.8;
}

// if (imageryLayers.length > 0) { // black marble
//     let layer = imageryLayers.get(0);
//     layer.saturation = 0;
//     // layer.contrast = 1.8;
//     // layer.brightness = 0.8;
// }

// Load Infobox css
viewer.infoBox.frame.addEventListener('load', function () {
    let cssLink = viewer.infoBox.frame.contentDocument.createElement('link');
    cssLink.href = 'infobox.css';
    cssLink.rel = 'stylesheet';
    cssLink.type = 'text/css';
    viewer.infoBox.frame.contentDocument.head.appendChild(cssLink);
}, false);


// Add credit footnote for Joshua Project
let jpCredit = new Cesium.Credit('Joshua Project', 'assets/jp_logo_color.png', 'https://joshuaproject.net'),
    nasaCredit = new Cesium.Credit('NASA Socioeconomic Data and Applications Center (SEDAC)', 'assets/nasa-logo.svg', 'http://sedac.ciesin.columbia.edu/data/collection/gpw-v4');
viewer.scene.frameState.creditDisplay.addDefaultCredit(jpCredit);
viewer.scene.frameState.creditDisplay.addDefaultCredit(nasaCredit);

let loadedElements = [];
updateLoadingStatus = function(loadedElement) {
    if (loadedElements.includes(loadedElement.constructor.name)) {
        return;
    }
    loadedElements.push(loadedElement.constructor.name)
    if (loadedElements.length > 1) {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
}

// Load Data Source
viewer.dataSources.add(dataSource).then(updateLoadingStatus);
viewer.scene.globe.tileLoadProgressEvent.addEventListener(function(status) {
    if (status === 0) {
        updateLoadingStatus(viewer.scene.globe);
    }
});


let describedEntities = [],
    now = Cesium.JulianDate.now(),
    piles = [];
