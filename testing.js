// Servicio para justificar la ultima parada
try {
	if (woNumber && username && resource && reason) {

		// Function to format a JavaScript Date object to SQL timestamp format
		function toSqlTimestamp(date) {
			const pad = (number) => number < 10 ? '0' + number : number;
			return date.getFullYear() + '-' +
				pad(date.getMonth() + 1) + '-' +
				pad(date.getDate()) + ' ' +
				pad(date.getHours()) + ':' +
				pad(date.getMinutes()) + ':' +
				pad(date.getSeconds());
		}

		const sqlDate = toSqlTimestamp(new Date());

		// update last period opened
		let result = Things["CIP.Database.Postgresql"].Command({
			command: "UPDATE CIP_PERIODS SET END_PERIOD = '" + sqlDate + "' WHERE END_PERIOD IS NULL AND RESOURCE = '" + resource + "'" /* STRING */
		});

		// format the date for sql
		var end_period = me.GetDateFromStrings({
			hour: new Date().getHours().toString(),
			minute: new Date().getMinutes().toString()
		});

		// create new period
		me.InsertNewPeriod({
			wonumber: woNumber /* STRING */ ,
			username: username /* STRING */ ,
			resource: resource /* STRING */ ,
			start_period: end_period /* DATETIME */ ,
			reason: reason /* STRING */ ,
			status: "Mantenimiento" /* STRING */ ,
			justified: true /* BOOLEAN */
		});
        
        Things["CIP.Resource."+resource].Now_Reason = "Maintenimiento"; // seria 
        Things["CIP.Resource."+resource].Now_State = "Mantenimiento";
        
		result = "Periodo de mantenimiento iniciado";
	} else {
		result = "OT, operario, recurso y razon son necesarios!";
	}
} catch (error) {
	result = "ERROR";
	Things["CIP.WorkOrders.Controller"].ErrorLog.AddRow({
		entity: "CIP.ResourcesManager.Services",
		resource: resource,
		service: "InsertNewPeriod",
		error: error,
		date: Date.now(),
		inputs: "woNumber:" + woNumber + ",username:" + username + ",subprocess:" + subprocess + ",reason:" + reason
	});
}