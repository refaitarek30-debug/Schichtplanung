/** Seitenwechsel im Privatbereich: die neue Seite blendet sanft ein (siehe .seite-rein in globals.css). */
export default function Vorlage({ children }: { children: React.ReactNode }) {
  return <div className="seite-rein">{children}</div>;
}
