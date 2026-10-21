
import CatalogueConfiguration from "@/components/lavage/CatalogueConfiguration";

export default function TypesLavagePage() {
  return (
    <CatalogueConfiguration
      mode="prestation"
      endpoint="/api/lavage/types-lavage"
      title="Types de lavage"
      singular="Type de lavage"
      subtitle="Configurez vos prestations et leurs prix de référence."
    />
  );
}
