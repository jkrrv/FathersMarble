
var parseSync = require('csv-parse/lib/sync');
var parse = require('csv-parse');
var fs = require('fs');
var https = require('https');
var _ = require('underscore');

var grid = {};
var nasaLoaded = false;

var populationMargin = 1E7;


function GridPoint() {
    this.peoples = {};
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
    this.jPScale = parseFloat(csvObj.JPScale);
    this.pctEvangel = parseFloat(csvObj.PercentEvangelical)*.01 || 0;
    this.pctAdherant = parseFloat(csvObj.PercentAdherents)*.01 || 0;
    this.populationUnassigned = parseInt(csvObj.Population) || 0;
    this.populationTotal = this.populationUnassigned;
    this.lat = parseFloat(csvObj.Latitude);
    this.lng = parseFloat(csvObj.Longitude);

}
Object.defineProperties(Village.prototype, {
    peopleIdStr : {
        get : function() {
            return this.peopleId.toString();
        }
    }
});
Village.prototype.assignToGrid = function() {
    var lat = this.lat,
        lng = this.lng;

    var remaining = this.assignToPile(Math.round(lat/2) * 2, Math.round(lng/2) * 2);

    if (remaining <= 0) {
        return;
    }
    if(_.find(this.listPeripheralZones(lat, lng, 10), function(zone, i) {
            if (this.assignToPile(zone.lat, zone.lng) == 0) {
                return true;
            }
        }, this) != undefined) return;

    if(_.find(this.listPeripheralZones(lat, lng, 30), function(zone, i) {
            if (this.assignToPile(zone.lat, zone.lng) == 0) {
                return true;
            }
        }, this) != undefined) return;

    if(_.find(this.listPeripheralZones(lat, lng, 90), function(zone) {
            if (this.assignToPile(zone.lat, zone.lng) == 0) {
                return true;
            }
        }, this) != undefined) return;

    if(_.find(this.listPeripheralZones(lat, lng, 180), function(zone) {
            if (this.assignToPile(zone.lat, zone.lng) == 0) {
                return true;
            }
        }, this) != undefined) return;

    console.log("-> people group ", this.peopleIdStr, " not fully assigned. ", this.populationUnassigned, "unassigned of", this.populationTotal);

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

    if (typeof grid[lat][lng].peoples[this.peopleIdStr]  != 'undefined') {
    // Another country of this people group is already in this position.  Merge.  (Common among small countries, like SE Asia.)

        var peopleObj = grid[lat][lng].peoples[this.peopleIdStr];

        if (peopleObj.pop < assignable && peopleObj.jps != this.jPScale) {
            peopleObj.jps = this.jPScale;
        }

        peopleObj.adh = (peopleObj.adh * peopleObj.pop + this.pctAdherant * assignable) / (peopleObj.pop + assignable);
        peopleObj.evn = (peopleObj.evn * peopleObj.pop + this.pctEvangel * assignable) / (peopleObj.pop + assignable);

        peopleObj.pop += assignable;

    } else {
        grid[lat][lng].peoples[this.peopleIdStr] = {
            pop: assignable,
            adh: this.pctAdherant,
            evn: this.pctEvangel,
            jps: this.jPScale
        };
    }

    return this.populationUnassigned;
};


/* JOSHUA PROJECT DATA DOWNLOAD/UPDATE */
/* Download new Joshua Project data if it doesn't exist or is just old. */
if (!fs.existsSync('raw/JoshuaProject/AllPeoplesByCountryListing.csv') ||
    ((new Date()) - fs.statSync('raw/JoshuaProject/AllPeoplesByCountryListing.csv').mtime) > (86400*7)) {

    var file = fs.createWriteStream('raw/JoshuaProject/AllPeoplesByCountryListing.csv');
    https.get("https://joshuaproject.net/resources/datasets/1", function(response) {
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
    fs.readFileSync('raw/JoshuaProject/AllPeoplesByCountryListing.csv').toString().split('\n').forEach(function (line) {
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

    console.log("Assigning villages to grid...");
    _.each(villages, function(v) {
        v.assignToGrid();
    });
    console.log("...done.");

    var popHolesRemaining = 0,
        gridSubset = [];
    _.each(grid, function(row, lat) {
        _.each(row, function(cell, lng) {
            if (lng !== "Lat") {
                popHolesRemaining += cell.emptyPop;
                if (!_.isEmpty(cell.peoples)) {
                    gridSubset.push({
                        lat: parseInt(lat),
                        lng: parseInt(lng),
                        peoples: cell.peoples
                    });
                }
            }
        });
    });
    console.log("Population holes remaining:",  popHolesRemaining);

    fs.unlinkSync('geo.json');

    fs.writeFile("geo.json", JSON.stringify(gridSubset), function(err){
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
                    peoples: {}
                };
                nasaPopSum += pop;
            }
        });
    });

    console.log("Nasa data loaded containing a population of ", nasaPopSum);

    nasaLoaded = nasaPopSum;
}