try {
	// faultState is the state of the machine after the maintenance
	// Averia no resuelta
	// Mantenimiento finalizado, habilitar maquina
	// Mantenimiento finalizado, pero nueva averia detectada
	if (comments && closureAttribute.length > 0 && faultState) {

		let isResourceAvailable = faultState === "Mantenimiento finalizado, habilitar maquina" ? true : false;

		// helper function to transform unix number into hh-mm-ss
		const msToTime = (duration) => {
			let seconds = Math.floor((duration / 1000) % 60),
				minutes = Math.floor((duration / (1000 * 60)) % 60),
				hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

			hours = hours < 10 ? "0" + hours : hours;
			minutes = minutes < 10 ? "0" + minutes : minutes;
			seconds = seconds < 10 ? "0" + seconds : seconds;

			return hours + ":" + minutes + ":" + seconds;
		};

		// get the OT to start the maintenance
		let otMaintenanceToUpdate = Things["CIP.Database.Postgresql"].Query({
			query: "SELECT * FROM MAINTENANCE WHERE UID = " + uid /* STRING */ ,
		});

		let attributes = closureAttribute ?
			closureAttribute.rows
			.toArray()
			.map((attribute) => attribute.element)
			.join(", ") :
			undefined;

		let timeOfMaintenance = msToTime(
			new Date() - otMaintenanceToUpdate.start_time
		);

		// Check if otMaintenanceToUpdate has at least one row
		if (otMaintenanceToUpdate.length > 0) {
			Things["CIP.Database.Postgresql"].UpdateMaintenance({
				START_TIME: otMaintenanceToUpdate.start_time /* DATETIME */ ,
				COMMENTS: comments /* STRING */ ,
				WO_NUMBER: otMaintenanceToUpdate.wo_number /* STRING */ ,
				MAINTENANCE_TYPE: otMaintenanceToUpdate.maintenance_type /* STRING */ ,
				NOTES: otMaintenanceToUpdate.notes /* STRING */ ,
				UID: uid /* LONG */ ,
				END_TIME: faultState === "Averia no resuelta" ? undefined : new Date() /* DATETIME */ ,
				SCHEDULED_DATE: otMaintenanceToUpdate.scheduled_date /* DATETIME */ ,
				DESCRIPTION: otMaintenanceToUpdate.description /* STRING */ ,
				MAINTENANCE_TIME: faultState === "Averia no resuelta" ? undefined : timeOfMaintenance /* STRING */ ,
				CLOSURE_ATTRIBUTE: attributes /* STRING */ ,
				EXTRA_PERSONAL: otMaintenanceToUpdate.extra_personal /* STRING */ ,
				MAINTENANCE_STATUS: faultState === "Averia no resuelta" ? "Averia no resuelta" : isResourceAvailable ? "Cerrado" : "Cerrado pero nueva averia detectada" /* STRING */ ,
				USERNAME: otMaintenanceToUpdate.username /* STRING */ ,
				RESOURCE: otMaintenanceToUpdate.resource /* STRING */ ,
				AVAILABLE: faultState === "Averia no resuelta" ? false : isResourceAvailable /* BOOLENA */ ,
			});

			// update the cip_periods and resource properties
			Things["CIP.ResourcesManager.Services"].EndMaintenanceTestPeriod({
				faultState: faultState /* BOOLEAN */ ,
				resource: otMaintenanceToUpdate.resource /* STRING */ ,
				woNumber: otMaintenanceToUpdate.wo_number /* STRING */ ,
				username: otMaintenanceToUpdate.username /* STRING */ ,
			});
			result = "ok";
		} else {
			result = "UID does not match any data!";
		}
	} else {
		result = "Comentarios(min 200 caracteres) y atributo(s) son necesarios!";
	}
} catch (error) {
	result = "ERROR " + error;
	Things["CIP.WorkOrders.Controller"].ErrorLog.AddRow({
		entity: "CIP.MaintenanceManager.Controller",
		resource: undefined,
		service: "EndMaintenancetest",
		error: error,
		date: Date.now(),
		inputs: "uid: " + uid + " comments: " + comments,
	});
}