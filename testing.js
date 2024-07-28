// Servicio para cancelar lineas de tiempo abiertas para un recurso
try {
	// get the cip_period uid to delete
	let periodToDelete = Things["CIP.Database.Postgresql"].Query({
		query: "SELECT uid, start_period FROM cip_periods WHERE end_period IS NULL AND resource = '" + resource + "'"
	});

	// format the end_period to update
	let endPeriod = new Date(periodToDelete.start_period); // Use this line if you want the current time
	let endPeriodToUpdate = dateFormat(endPeriod, "yyyy-MM-dd HH:mm:ss.SSS"); // Corrected format for 24-hour clock and milliseconds

	// get the cip_period uid to update
	let periodToUpdate = Things["CIP.Database.Postgresql"].Query({
		query: "SELECT * FROM cip_periods WHERE END_PERIOD = '" + endPeriodToUpdate + "' AND RESOURCE = '" + resource + "'"
	});

	// update the end_period and reason
	if (periodToUpdate) {
		Things["CIP.Database.Postgresql"].Command({
			command: "UPDATE CIP_PERIODS SET END_PERIOD = NULL, HOURS = NULL WHERE uid =" + periodToUpdate.uid
		});

		// update the resource thing
		Things["CIP.Resource." + resource].Now_Reason = periodToUpdate.reason;
		Things["CIP.Resource." + resource].Now_State = periodToUpdate.status;

	} else {
		result = "End_period not found!";
	}

	// delete the period
	if (periodToDelete) {
		Things["CIP.Database.Postgresql"].Command({
			command: "DELETE FROM CIP_PERIODS WHERE UID = " + periodToDelete.uid
		});
	} else {
		result = "Period not found!";
	}

	result = "ok";

} catch (error) {
	Things["CIP.WorkOrders.Controller"].ErrorLog.AddRow({
		entity: "CIP.ResourcesManager.Services",
		resource: resource,
		service: "CancelMaintenancePeriods",
		error: error,
		date: Date.now(),
		inputs: "resource = " + resource
	});
}