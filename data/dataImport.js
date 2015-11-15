/**
 * Created by James on 11/14/2015.
 */


var parse = require('csv-parse');
var fs = require('fs');
var _ = require('underscore');

var grid = {};
var peoples = {};
var nasaLoaded = false;


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


function Village(csvRow) {
    this.peopleId = parseInt(csvRow.PEOPLEID3);
    this.jPScale = parseFloat(csvRow.JPSCALE);
    this.pctEvangel = parseFloat(csvRow.PERCENTEVANGELICAL);
    this.pctAdherant = parseFloat(csvRow.PERCENTADHERENTS);
    this.populationUnassigned = parseInt(csvRow.POPULATION);
    this.populationTotal = this.populationUnassigned;
    this.lat = parseFloat(csvRow.LATITUDE);
    this.lng = parseFloat(csvRow.LONGITUDE);

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

    var remaining = this.assignToGridPoint(Math.round(lat/2) * 2, Math.round(lng/2) * 2);

    if (remaining <= 0) {
        return;
    }
    if(_.find(this.listPeripheralZones(lat, lng, 10), function(zone, i) {
            if (this.assignToGridPoint(zone.lat, zone.lng) == 0) {
                return true;
            }
        }, this) != undefined) return;

    if(_.find(this.listPeripheralZones(lat, lng, 30), function(zone, i) {
            if (this.assignToGridPoint(zone.lat, zone.lng) == 0) {
                return true;
            }
        }, this) != undefined) return;

    if(_.find(this.listPeripheralZones(lat, lng, 180), function(zone, i) {
            if (this.assignToGridPoint(zone.lat, zone.lng) == 0) {
                return true;
            }
        }, this) != undefined) return;

    console.log("not fully assigned. ", this.peopleIdStr, this.populationUnassigned, "unassigned of", this.populationTotal);

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
Village.prototype.assignToGridPoint = function(lat, lng) {
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
        grid[lat][lng].peoples[this.peopleIdStr] += assignable;
    } else {
        grid[lat][lng].peoples[this.peopleIdStr] = assignable;
    }

    return this.populationUnassigned;
};




/* JOSHUA PROJECT CSV PARSING */
{
    var csv = [];
    var jpParser = parse({columns: true});
    jpParser.on('readable', function () {
        var record;
        while (record = jpParser.read()) {
            csv.push(record);
        }
    });
    jpParser.on('error', function (err) {
        console.error(err.message);
    });
    jpParser.on('finish', function () {
        sortAndFilterJP(csv);
    });
}

{
    var nasa = [];
    var nasaParser = parse({columns: true});
    nasaParser.on('readable', function () {
        var record;
        while (record = nasaParser.read()) {
            nasa.push(record);
        }
    });
    nasaParser.on('error', function (err) {
        console.error(err.message);
    });
    nasaParser.on('finish', function () {
        nasaGridify(nasa);
    });
}


fs.createReadStream('raw/JoshuaProject/AllPeoplesByCountryListing.csv').pipe(jpParser);
fs.createReadStream('raw/NASA/nasaPopModified.csv').pipe(nasaParser);



/* JOSHUA PROJECT DATA FILTER AND SORT */

function sortAndFilterJP(data) {
    data = _.reject(data, function(row) {
        return (isNaN(parseInt(row.POPULATION)) || isNaN(parseFloat(row.LATITUDE)) || isNaN(parseFloat(row.LONGITUDE)));
    });

    var populationSum = 0;
    var villages = [];
    _.each(data, function (villageRow) {
        villages.push(new Village(villageRow));
    });

    villages = _.sortBy(villages, function(v) {
        populationSum += v.populationTotal;
        return v.populationTotal;
    });

    console.log("Parsed from Joshua Project CSV ", populationSum, " people in ", data.length, " Villages.");

    while (!nasaLoaded) {}

    var populationScalar = (populationSum + 1E6)/nasaLoaded;

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
            if (lng != "Lat") {
                popHolesRemaining += cell.emptyPop;
                if (!_.isEmpty(cell.peoples)) {
                    gridSubset.push({
                        lat: lat,
                        lng: lng,
                        peoples: cell.peoples
                    });
                }
            }
        });
    });
    console.log("Population holes remaining:",  popHolesRemaining);

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
            if (long != "Lat") {
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