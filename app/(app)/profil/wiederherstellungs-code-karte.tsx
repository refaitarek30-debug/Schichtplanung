"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { WiederherstellungsCode } from "@/components/privat/mehr";

/**
 * Eigener Wiederherstellungs-Code für Betriebskonten. Nur die Person selbst kennt ihn:
 * Damit setzt sie unter „Passwort vergessen“ ein neues Passwort – ohne E-Mail und ohne
 * dass jemand anderes etwas freigeben muss.
 */
export function WiederherstellungsCodeKarte() {
  return (
    <div data-wiederherstellung>
      <Card className="h-fit">
        <CardHeader title="Passwort vergessen? Eigener Code" />
        <CardBody className="p-0">
          <WiederherstellungsCode />
        </CardBody>
      </Card>
    </div>
  );
}
