# Pfandapp auf Android installieren

Die App ist eine PWA. Sie wird einmal über eine HTTPS-Adresse geöffnet und kann dann in Chrome zum Startbildschirm hinzugefügt werden. Nach dem ersten Laden bleibt die Oberfläche für die Offline-Nutzung verfügbar. Abgeschlossene Sammlungen warten bei fehlender Verbindung und werden synchronisiert, sobald die Verbindung während der geöffneten App zurückkehrt oder du die App das nächste Mal online öffnest.

## 1. Web-App veröffentlichen

Die Dateien in diesem Ordner müssen auf einem statischen HTTPS-Webhost liegen. GitHub Pages ist eine Möglichkeit:

1. Lege auf GitHub ein Repository an.
2. Lade **den Inhalt** dieses Ordners in das Repository hoch: `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `service-worker.js` und `icon.svg`.
3. Aktiviere für das Repository unter **Settings → Pages** die Veröffentlichung aus dem Hauptbranch.
4. Öffne die von GitHub angezeigte HTTPS-Adresse auf deinem Android-Handy in Chrome.

Alternativ kannst du einen anderen statischen Webhost verwenden, der HTTPS unterstützt. Die Dateien benötigen keinen Server-Build.

## 2. Google Sheets verbinden

1. Öffne oder erstelle eine Google-Tabelle.
2. Wähle **Erweiterungen → Apps Script** und ersetze den Script-Inhalt durch [`../google-apps-script/Code.gs`](../google-apps-script/Code.gs).
3. Speichere und führe im Apps-Script-Editor die Funktion `setup` einmal aus. Bestätige den Zugriff auf die Tabelle.
4. Wähle **Bereitstellen → Neue Bereitstellung → Web-App**. Stelle **Ausführen als: Ich** und **Zugriff: Jeder** ein, dann bereitstellen.
5. Kopiere die URL der Web-App, die auf `/exec` endet.
6. Öffne die Pfandapp, tippe auf das Zahnrad, füge die URL ein und speichere.

Der Apps-Script-Endpunkt darf von jedem aufgerufen werden, der seine URL kennt. Behandle die URL daher vertraulich. Eine eindeutige Sammlungs-ID verhindert doppelte Tabellenzeilen bei automatischen Wiederholungen.

## 3. Zum Startbildschirm hinzufügen

1. Öffne die veröffentlichte Web-App in **Chrome auf Android**.
2. Öffne das Chrome-Menü und tippe auf **Installieren** oder **Zum Startbildschirm hinzufügen**.
3. Starte die App anschließend über das neue Pfandapp-Symbol.

Die Daten der laufenden und abgeschlossenen Sammlungen liegen im Browser-Speicher dieses Geräts. Lösche die Website-Daten in Chrome nicht, solange noch Sammlungen auf die Synchronisierung warten.
