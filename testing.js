	// get all OTs of the day
	let last24HOts = me.GetLast24HOts();

	// CreateInfoTableFromDataShape(infoTableName:STRING("InfoTable"), dataShapeName:STRING):INFOTABLE(testingProportionalChart)
	let result = Resources["InfoTableFunctions"].CreateInfoTableFromDataShape({
		infoTableName: "InfoTable",
		dataShapeName: "CIP.Datashape.Panorama"
	});

	for (let i = 0; i < last24HOts.length; i++) {
		if (last24HOts[i].resource === resource) {
			result.AddRow({
				ot: last24HOts[i].ornume,
				concept: last24HOts[i].status,
				timeDuration: last24HOts[i].end_period - last24HOts[i].start_period
			});
		}
	}