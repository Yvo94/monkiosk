
import CatalogueConfiguration from "@/components/lavage/CatalogueConfiguration";

export default function TypesVehiculePage() {
  return (
    <CatalogueConfiguration
      mode="vehicule"
      endpoint="/api/lavage/types-vehicule"
      title="Types de véhicules"
      singular="Type de véhicule"
      subtitle="Configurez les véhicules acceptés par votre station de lavage."
    />
  );
}
