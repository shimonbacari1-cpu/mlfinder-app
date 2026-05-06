import "./globals.css";

export const metadata = {
  title: "MLFinder",
  description: "Buscar productos en Mercado Libre Argentina por imagen",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
