# The Father's Marble

The Father's Marble is an attempt to show the status of the Good News of Jesus Christ throughout the earth.  

## Data Sources

Data regarding people groups and their beliefs come from [Joshua Project's public datasets and APIs](http://joshuaproject.net/resources/datasets). 
THe Joshua Project exists to "Bring Definition to the Unfinished Task."  Unless there is a very strong, compelling reason to 

Data regarding general global population distributions comes from NASA's 
[Gridded Population of the World, Version 3](http://sedac.ciesin.columbia.edu/data/set/gpw-v3-population-density) 
provided through CIESIN and CIAT, and are scaled such that the total world population roughly matches Joshua Project data.  

## Terminology

For the purposes of this application, the term __Village__ does *not* refer to something like a small town, but rather 
specifically refers to a people group in a particular location.  For instance, 
[the Glaro-Twabo people](http://joshuaproject.net/people_groups/11907) are in two locations, and thus have two 
"Villages".

## How It Works

Joshua Project data provides a geographic epicenter for each Village, but doesn't provide any sort of population density 
information.  If we were to simply plot the Joshua Project data as-is, we would find, for instance, that all 180 million 
U.S. Americans (the second largest Village) live in the Mark Twain National Forest just off I-44 in the middle of 
Missouri.  However, most Americans don't live there.  Thus, we also use NASA's gridded population dataset, adjusted to 
2-degree precision, to better account for how people are distributed.  While this is an improvement, it still makes some 
things unexpected, such as blending Maine with Greenland and Aruba with Cuba.  To minimize the impact of this bleeding, 
smaller Villages are assigned to geographic locations first, because smaller Villages would, logically, be more 
condensed than larger Villages, and larger Villages are more likely to bleed between geographical grid points.  

## Data Issues

There are several known issues with the data used in this application, or the way the data is fit into the grid.

### Geographic Holes

Since this application focuses on attempting to locate people on the globe, only Villages with both population 
information and geographic information (in lat/long) are plotted.  When the data set was first compiled for this 
purpose, this meant that a total of 4,690,750 people (about 0.06% of the global population) are not accounted for.  
While we want to see the gospel reach each of these people, they have been left out of this visualization, as we have no 
good way to plot them.  Should lat/long data become available for these groups, we can easily update the data set. 
 
### Old Population Distribution Data

The gridded dataset we're using from NASA is dated 2000.  This is obviously old, but at the time of writing, it's the 
newest solid data available.  Since the population has expanded since then, NASA data is scaled proportionally such that
the sum equals the sum of the Joshua Project data.  Essentially, we're assuming that the population growth has occurred 
everywhere at the same rate, which isn't an accurate assumption, and makes some things weird.  It's not uncommon to find 
an unrealistic number of Han Chinese folks listed in Alaska. 

### Ambiguous Population Distribution Data

While we have distribution information for the human race as a whole, there is no readily available data that addresses 
the issue of which locations contain which people groups; that is, there isn't enough detail on where people are. 