
var parseSync = require('csv-parse/lib/sync');
var fs = require('fs');
var https = require('https');
var _ = require('underscore');

var grid = {};
var countries = {};
var nasaLoaded = false;

var populationMargin = 1E7;


function GridPoint() {
    this.villages = {};
}
GridPoint.prototype.getPopulation = function() {
    var sumPop = 0;
    _.each(this.peoples, function(peoplePop) {
        sumPop += peoplePop;
    });
    return sumPop;
};


function Village(csvObj) {
    this.peopleId = parseInt(csvObj.PeopleID3);
    this.countryCode = csvObj.ROG3;
    this.jPScale = parseFloat(csvObj.JPScale);
    this.pctEvangel = parseFloat(csvObj.PercentEvangelical)*.01 || 0;
    this.pctAdherant = parseFloat(csvObj.PercentAdherents)*.01 || 0;
    this.populationUnassigned = parseInt(csvObj.Population) || 0;
    this.populationTotal = this.populationUnassigned;
    this.lat = parseFloat(csvObj.Latitude);
    this.lng = parseFloat(csvObj.Longitude);
    this.nameLocal = csvObj.PeopNameInCountry;
    this.primaryLanguageName = csvObj.PrimaryLanguageName;
    this.primaryReligion = csvObj.PrimaryReligion;
    this.leastReached = (csvObj.LeastReached === 'Y' ? 1 : 0);
    this.ten40 = (csvObj['10_40Window'] === 'Y' ? 1 : 0);


    if (countries[this.countryCode] === undefined) {
        countries[this.countryCode] = csvObj.Ctry
    }
}
Object.defineProperties(Village.prototype, {
    peopleIdStr : {
        get : function() {
            return this.peopleId.toString();
        }
    },
    villageIdStr : {
        get: function() {
            return this.countryCode + this.peopleIdStr;
        }
    }
});
Village.prototype.assignToGrid = function() {
    var lat = this.lat,
        lng = this.lng;

    if (isNaN(lat) || isNaN(lng))
        return false;

    var remaining = this.assignToPile(Math.round(lat/2) * 2, Math.round(lng/2) * 2);

    if (remaining <= 0) {
        return;
    }
    if(_.find(this.listPeripheralZones(lat, lng, 10), function(zone, i) {
            if (this.assignToPile(zone.lat, zone.lng) === 0) {
                return true;
            }
        }, this) !== undefined) return;

    if(_.find(this.listPeripheralZones(lat, lng, 30), function(zone, i) {
            if (this.assignToPile(zone.lat, zone.lng) === 0) {
                return true;
            }
        }, this) !== undefined) return;

    if(_.find(this.listPeripheralZones(lat, lng, 90), function(zone) {
            if (this.assignToPile(zone.lat, zone.lng) === 0) {
                return true;
            }
        }, this) !== undefined) return;

    if(_.find(this.listPeripheralZones(lat, lng, 180), function(zone) {
            if (this.assignToPile(zone.lat, zone.lng) === 0) {
                return true;
            }
        }, this) !== undefined) return;

    console.log("-> village #", this.villageIdStr, " not fully assigned. ", this.populationUnassigned, "unassigned of", this.populationTotal);

};
Village.prototype.listPeripheralZones = function(lat, lng, degrees) {
    degrees = Math.round(degrees/2)*2;
    var zones = [];
    for (var i = (Math.round(lat/2)*2)-degrees; i <= lat+degrees; i+=2) {
        for (var j = (Math.round(lng/2)*2)-degrees; j <= lng+degrees; j+=2) {
            zones.push({
                //dst: Math.hypot(j - lng, i - lat),
                //oLat : lat,
                //oLng : lng,
                lat: i,
                lng: j
            })
        }
    }
    zones = _.sortBy(zones, function(z) {
        return Math.hypot( z.lat - lat, z.lng - lng);
    });

    return zones;
};
Village.prototype.assignToPile = function(lat, lng) {
    if (this.populationUnassigned <= 0)
        return 0;

    if (lat < -58 || lat > 82)
        return this.populationUnassigned;

    while (lng < -180)
        lng += 360;

    while (lng > 180)
        lng -= 360;

    lat = lat.toString();
    lng = lng.toString();

    if (grid[lat][lng].emptyPop <= 0)
        return this.populationUnassigned;

    var assignable = Math.min(grid[lat][lng].emptyPop.valueOf(), this.populationUnassigned.valueOf());

    this.populationUnassigned = this.populationUnassigned - assignable;
    grid[lat][lng].emptyPop = grid[lat][lng].emptyPop - assignable;

    // console.log("Assigning " + this.peopleIdStr + " of " + this.countryCode);

    if (grid[lat][lng].villages[this.villageIdStr] !== undefined) {
    // Another country of this people group is already in this position.  Merge.  (Common among small countries, like SE Asia.)

        // console.log(grid[lat][lng].villages[this.villageIdStr]);

        console.log("THIS SHOULD NEVER HAPPEN.  " + this.villageIdStr + "  " + this.peopleIdStr);

        // var peopleObj = grid[lat][lng].villages[this.villageIdStr];
        //
        // if (peopleObj.pop < assignable && peopleObj.jps !== this.jPScale) {
        //     peopleObj.jps = this.jPScale;
        // }
        //
        // peopleObj.adh = (peopleObj.adh * peopleObj.pop + this.pctAdherant * assignable) / (peopleObj.pop + assignable);
        // peopleObj.evn = (peopleObj.evn * peopleObj.pop + this.pctEvangel * assignable) / (peopleObj.pop + assignable);

        // peopleObj.pop += assignable;

    } else {
        var evangelicals = Math.round(this.pctEvangel * assignable);
        grid[lat][lng].villages[this.villageIdStr] = {
            pop: assignable,
            adh: Math.max(Math.round(this.pctAdherant * assignable) - evangelicals, 0),
            evn: evangelicals,
            jps: this.jPScale
        };
    }

    return this.populationUnassigned;
};

Village.prototype.getDetails = function() {
    return {
        nameLcl: this.nameLocal,
        pLang: this.primaryLanguageName,
        pRlgn: this.primaryReligion,
        LR: this.leastReached,
        ten40: this.ten40
    }
};

const jpFileName = 'raw/JoshuaProject/AllPeoplesByCountry.csv';
const jpDataUrl = 'https://joshuaproject.net/resources/datasets/1';


/* JOSHUA PROJECT DATA DOWNLOAD/UPDATE */
/* Download new Joshua Project data if it doesn't exist or is just old. */
if (!fs.existsSync(jpFileName) ||
    ((new Date()) - fs.statSync(jpFileName).mtime) > (86400*7)) {

    https.get(jpDataUrl, function(response) {
        if (response.statusCode !== 200) {
            // handle server/request errors.
            console.log("Joshua Project Download Attempt failed : " + response.statusMessage + " (" + response.statusCode + ")");
            parseNasaData();
            parseJPData();
            return;
        }
        var file = fs.createWriteStream(jpFileName);
        response.pipe(file);
        response.on('end', function() {
            parseNasaData();
            parseJPData();
        });
    });
} else {
    parseNasaData();
    parseJPData();
}


function parseJPData() {
    var mode = "init",
        columnHeadings = [],
        jpData = [];
    fs.readFileSync(jpFileName).toString().split('\n').forEach(function (line) {
        switch (mode) {
            case "init":
                if (line.indexOf(',') !== -1) {
                    mode = "body";
                    columnHeadings = parseSync(line, {})[0];
                }
                break;
            case "body":
                if (line.indexOf(',') === -1) {
                    mode = "footer";
                    break;
                }
                jpData.push(parseSync(line, {
                    columns:columnHeadings,
                    auto_parse: true
                })[0]);
                break;
        }
    });
    sortAndFilterJP(jpData);
}

function parseNasaData() {
    nasaGridify(
        parseSync(fs.readFileSync('raw/NASA/nasaPopModified.csv').toString(), {
            columns: true
        })
    );
}


/* JOSHUA PROJECT DATA FILTER AND SORT */

function sortAndFilterJP(data) {

    // Remove items that don't have sufficient population or location data.
    data = _.reject(data, function(row) {
        return (isNaN(row.Population) || isNaN(row.Latitude) || isNaN(row.Longitude));
    });

    // Create Villages from the remaining objects
    var populationSum = 0;
    var villages = [];
    _.each(data, function (villageRow) {
        villages.push(new Village(villageRow));
    });

    // Sort by populations, least to most.
    villages = _.sortBy(villages, function(v) {
        populationSum += v.populationTotal;
        return v.populationTotal;
    });

    console.log("Parsed from Joshua Project CSV: ", populationSum, " people in ", data.length, " Villages.");

    while (!nasaLoaded) {}

    var populationScalar = (populationSum + populationMargin)/nasaLoaded;

    _.each(grid, function(gridR) {
        _.each(gridR, function(gridC) {
            gridC.emptyPop = Math.round(gridC.emptyPop * populationScalar);
        })
    });

    console.log("Adjusted Nasa data to (nearly) match sum of Joshua Project data.");

    console.log("Assigning villages to grid and saving village JSON files...");
    _.each(villages, function(v) {
        console.log("Village " + v.villageIdStr + "...");

        v.assignToGrid();

        if (fs.existsSync('v/' + v.villageIdStr + '.json'))
            fs.unlinkSync('v/' + v.villageIdStr + '.json');

        if (!fs.existsSync('v/'))
            fs.mkdirSync('v');

        // console.log("Writing " + v.villageIdStr);
        fs.writeFileSync('v/' + v.villageIdStr + '.json', JSON.stringify(v.getDetails()));
    });
    console.log("...done.");

    var popHolesRemaining = 0,
        gridSubset = [];
    _.each(grid, function(row, lat) {
        _.each(row, function(cell, lng) {
            if (lng !== "Lat") {
                popHolesRemaining += cell.emptyPop;
                if (!_.isEmpty(cell.villages)) {

                    // Sort villages within the pile so the bigger ones are first.  This appears to be the only way to maintain the order of the keys.
                    var villagesSortedKeys = _.sortBy(cell.villages, function(v, vid){
                        v.id = vid;
                        return -v.pop;
                    });
                    var villagesSorted = {};
                    _.each(villagesSortedKeys, function(vsk) {
                        var vid = vsk.id.toString();
                        villagesSorted[vid] = cell.villages[vid];
                        delete villagesSorted[vid].id;
                    });


                    gridSubset.push({
                        lat: parseInt(lat),
                        lng: parseInt(lng),
                        v: villagesSorted
                    });
                }
            }
        });
    });
    console.log("Population holes remaining:",  popHolesRemaining);


    // Some manual edits for the list of countries:
    countries.KN = "North Korea (DPRK)";
    countries.KS = "South Korea (ROK)";
    countries.CG = "Democratic Republic of the Congo";
    countries.CF = "Republic of the Congo";


    if (fs.existsSync('geo.json'))
        fs.unlinkSync('geo.json');

    fs.writeFile("geo.json", JSON.stringify(
        {
            grid: gridSubset,
            ctry: countries
        }
    ), function(err){
        if(err){
            console.log(err);
        } else {
            console.log("Grid Data Exported.");
        }
    });
}


function nasaGridify(data) {
    var nasaPopSum = 0;

    _.each(data, function(row) {
        //var lat = parseInt(row.Lat);
        var lat = row.Lat;
        grid[lat] = {};

        _.each(row, function(cell, long) {
            if (long !== "Lat") {
                //long = parseInt(long);
                var pop = parseInt(cell);
                grid[lat][long] = {
                    emptyPop: pop,
                    villages: {}
                };
                nasaPopSum += pop;
            }
        });
    });

    console.log("Nasa data loaded containing a population of ", nasaPopSum);

    nasaLoaded = nasaPopSum;
}