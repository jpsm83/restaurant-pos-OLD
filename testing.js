// Define the filter for Things
var params = {
    nameMask: undefined, // use undefined or a wildcard "*" to match all
    type: "Thing", // Specify the type as "Thing"
    tags: undefined // Filter by tags if necessary
};

// Get a list of all Things
var thingsList = Resources["EntityServices"].GetEntityList(params);


let dataArr = thingsList.rows.toArray().map((element) => element.rows);

result = dataArr