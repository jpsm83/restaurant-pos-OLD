Things["CIP.Database.Postgresql"].Command({
  Command: "DELETE FROM cip_periods WHERE END_PERIOD IS NULL AND RESOURCE = '" + resourceName + "'" /* STRING */ ,
});