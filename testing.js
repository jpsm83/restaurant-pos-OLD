// Servicio para justificar la ultima parada de posible averia
// "Averia NO detectada, ajuste de maquina executado", "Averia detectada, OT de mantenimiento en creacion"
// ***** si es una "Averia NO detectada, ajuste de maquina executado", cual sera el concpeto / status?????

try {
	if (resource && dropdown && username) {
		const dateNow = new Date();
		let dateNowFormatted = dateFormat(dateNow, "yyyy-MM-dd hh:mm:ss");

		// get the resource periode where end_period is null
		let periodToUpdate = Things["CIP.Database.Postgresql"].Query({
			query: "SELECT * FROM cip_periods WHERE END_PERIOD IS NULL AND RESOURCE = '" + resource + "'" /* STRING */ ,
		});

		if (periodToUpdate) {
			// calculate the hours from last period
			let calculatePeriodHours = me.CalculatePeriodHours({
				start_period: periodToUpdate.start_period.getTime() /* NUMBER */ ,
			});

			let newPeriodParams = {
				reason: undefined /* STRING */ ,
				status: undefined /* STRING */ ,
				concept: undefined /* STRING */ ,
			};

			let commentValue = comment ? comment : null;
			let usernameValue = periodToUpdate.username;
			let statusValue = periodToUpdate.status;
			let timeDescriptionValue = periodToUpdate.time_description;
			let conceptValue = periodToUpdate.concept;
			let timeOeeValue = periodToUpdate.time_oee;
			let reasonValue = periodToUpdate.reason;

			if (dropdown === "Averia NO detectada, ajuste de maquina executado") {
				Things["CIP.Resource." + resource].Now_Reason = "Falta: OT";
				Things["CIP.Resource." + resource].Now_State = "Parada";
				Things["CIP.Resource." + resource].Aux_JustifyTimeNeeded = false;
				Things["CIP.Resource." + resource].Aux_TimeCounterEnabled = true;

				// // update cip_periods with the end time, total hours, reason and justified where period id null
				// Things["CIP.Database.Postgresql"].Command({
				// 	command: "UPDATE CIP_PERIODS SET comment = '" + commentValue + "', END_PERIOD = '" + dateNowFormatted + "', HOURS = " + calculatePeriodHours + ", USERNAME = '" + username + "', STATUS = 'Parada', JUSTIFIED = true, REASON = 'Preparacion previa a OT', concept = 'Limpieza y preparacion', time_oee = 'tON' WHERE END_PERIOD IS NULL AND RESOURCE = '" + resource + "'" /* STRING */ ,
				// });

				usernameValue = username;
				statusValue = "Parada";
				timeDescriptionValue = "Perdidas velocidad";
				conceptValue = "Limpieza y preparacion";
				timeOeeValue = "tON";
				reasonValue = "Preparacion previa a OT";

				newPeriodParams.reason = "Falta: OT";
				newPeriodParams.status = "Parada";
				newPeriodParams.concept = "Falta";
			} else if (
				dropdown === "Averia detectada, OT de mantenimiento en creacion"
			) {
				Things["CIP.Resource." + resource].Now_Reason =
					"Esperando mantenimiento correctivo";
				Things["CIP.Resource." + resource].Now_State = "Averia";

				// // update cip_periods with the end time, total hours, reason and justified where period id null
				// Things["CIP.Database.Postgresql"].Command({
				// 	command: "UPDATE CIP_PERIODS SET comment = '" + commentValue + "', END_PERIOD = '" + dateNowFormatted + "', HOURS = " + calculatePeriodHours + ", JUSTIFIED = true WHERE END_PERIOD IS NULL AND RESOURCE = '" + resource + "'" /* STRING */ ,
				// });

				newPeriodParams.reason = "Esperando mantenimiento correctivo";
				newPeriodParams.status = "Averia";
				newPeriodParams.concept = "Mantenimiento";
			}

			// update cip_periods with the end period, total hours, reason and justified where period id null
			Things["CIP.Database.Postgresql"].UpdatePeriods({
				SUBPROCESS: periodToUpdate.subprocess /* STRING */ ,
				START_PERIOD: periodToUpdate.start_period /* DATETIME */ ,
				TIME_DESCRIPTION: timeDescriptionValue /* STRING */ ,
				ELEC: periodToUpdate.elec /* NUMBER */ ,
				COMMENT: commentValue /* STRING */ ,
				UID: periodToUpdate.uid /* INTEGER */ ,
				JUSTIFIED: true /* BOOLEAN */ ,
				STATUS: statusValue /* STRING */ ,
				CONCEPT: conceptValue /* STRING */ ,
				HOURS: calculatePeriodHours /* NUMBER */ ,
				ORNUME: periodToUpdate.ornume /* STRING */ ,
				USERNAME: usernameValue /* STRING */ ,
				TIME_OEE: timeOeeValue /* STRING */ ,
				REASON: reasonValue /* STRING */ ,
				UNITS_PRODUCED: periodToUpdate.units_produced /* NUMBER */ ,
				END_PERIOD: new Date() /* DATETIME */ ,
				RESOURCE: periodToUpdate.resource /* STRING */
			});

			// // create new period
			// me.InsertNewPeriod(newPeriodParams);

// create new period
			Things["CIP.Database.Postgresql"].InsertPeriods({
				resource: resource /* STRING */ ,
				username: username /* STRING */ ,
				justified: true /* BOOLEAN */ ,
				startPeriod: new Date() /* DATETIME */ ,
				reason: newPeriodParams.reason /* STRING */ ,
				status: newPeriodParams.status /* STRING */,
				concept: newPeriodParams.concept /* STRING */ ,
				timeOee: "tO" /* STRING */ ,
				timeDescription: "Tiempo muerto" /* STRING */ ,
			});
            
			result = "ok";
		} else {
			result = "Cip_periods not found!";
		}
	} else {
		result = "Razon es necesaria!";
	}
} catch (error) {
	result = "ERROR: " + error;
	Things["CIP.WorkOrders.Controller"].ErrorLog.AddRow({
		entity: "CIP.ResourcesManager.Services",
		resource: resource,
		service: "JustifyFaultStop",
		error: error,
		date: Date.now(),
		inputs: "comment:" + comment + ", dropdown:" + dropdown + ", resource:" + resource + ", username:" + username,
	});
}