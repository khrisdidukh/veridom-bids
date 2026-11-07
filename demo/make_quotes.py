from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors

pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
S = ParagraphStyle("s", fontName="DV", fontSize=8.5, leading=11)
B = ParagraphStyle("b", fontName="DVB", fontSize=13, leading=16)
H = ParagraphStyle("h", fontName="DVB", fontSize=9, leading=12)
F = ParagraphStyle("f", fontName="DV", fontSize=7, leading=9, textColor=colors.grey)

def de(n):
    s = f"{n:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")

def quote(fname, firm, addr, mail, nr, date, valid, positions, terms):
    doc = SimpleDocTemplate(fname, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=16*mm, bottomMargin=16*mm)
    el = [Paragraph(firm, B), Paragraph(addr + " · " + mail, S), Spacer(1, 8*mm),
          Paragraph("An: Fam. Muster, Musterstraße 5, 1030 Wien", S), Spacer(1, 5*mm),
          Paragraph(f"ANGEBOT Nr. {nr}", H),
          Paragraph(f"Datum: {date} · gültig bis: {valid}", S),
          Paragraph("Betreff: Badsanierung ca. 7,5 m², Wien 1030", S), Spacer(1, 4*mm)]
    rows = [["Pos.", "Leistung", "Menge", "EH", "EP €", "GP €"]]
    net = 0
    for p in positions:
        pos, text, qty, unit, ep = p[:5]
        if ep is None:
            rows.append([pos, Paragraph(text, S), "", "", "", p[5] if len(p) > 5 else "bauseits"])
        else:
            gp = round((qty or 1) * ep, 2)
            alt = len(p) > 5 and p[5] == "alt"
            if not alt: net += gp
            rows.append([pos, Paragraph(text + (" <i>(Alternativposition, nicht in Summe)</i>" if alt else ""), S),
                         de(qty).rstrip("0").rstrip(",") if qty else "1", unit, de(ep), de(gp)])
    vat = round(net * 0.2, 2)
    rows += [["", "Summe netto", "", "", "", de(net)], ["", "zzgl. 20 % USt", "", "", "", de(vat)], ["", "Gesamtsumme brutto", "", "", "", de(net + vat)]]
    t = Table(rows, colWidths=[12*mm, 88*mm, 15*mm, 14*mm, 20*mm, 22*mm])
    t.setStyle(TableStyle([("FONT", (0,0), (-1,-1), "DV", 8.5), ("FONT", (0,0), (-1,0), "DVB", 8.5),
        ("FONT", (0,-3), (-1,-1), "DVB", 8.5), ("LINEBELOW", (0,0), (-1,0), 0.6, colors.black),
        ("LINEABOVE", (0,-3), (-1,-3), 0.6, colors.black), ("ALIGN", (2,0), (-1,-1), "RIGHT"),
        ("VALIGN", (0,0), (-1,-1), "TOP")]))
    el += [t, Spacer(1, 6*mm)] + [Paragraph(x, S) for x in terms]
    el += [Spacer(1, 10*mm), Paragraph("Fiktives Demo-Angebot für Veridom Bids. Firma, Adresse und Preise sind erfunden.", F)]
    doc.build(el)
    print(fname, de(net))

quote("Angebot_Novak_Bau.pdf", "Novak Bau & Fliese GmbH", "Musterweg 12, 1100 Wien", "office@novak-bau.example",
      "2026-118", "02.11.2026", "02.12.2026", [
    ("01", "Abbrucharbeiten: Wand- und Bodenfliesen, Badewanne, WC und Waschtisch demontieren", 1, "psch", 1180),
    ("02", "Schuttentsorgung inkl. Container und Deponiegebühr", 1, "psch", 420),
    ("03", "Verbundabdichtung Boden und Duschbereich, 2-lagig", 9, "m²", 58),
    ("04", "Ausgleichsestrich Boden", 7.5, "m²", 44),
    ("05", "Wandfliesen verlegen, Format 60×60, inkl. Kleber und Fugen", 22, "m²", 72),
    ("06", "Bodenfliesen verlegen, Format 60×60, inkl. Kleber und Fugen", 7.5, "m²", 74),
    ("07", "Fliesenmaterial Feinsteinzeug 60×60 lt. Muster, inkl. 10 % Verschnitt", 32, "m²", 46),
    ("08", "Bodengleiche Dusche mit Duschrinne 80 cm, liefern und montieren", 1, "Stk", 620),
    ("09", "Wand-WC inkl. Vorwandelement und Betätigungsplatte", 1, "Stk", 890),
    ("10", "Waschtisch 60 cm mit Einhebelmischer, montiert", 1, "Stk", 610),
    ("11", "Elektro: 2 Steckdosen, Deckenleuchte, Abluftventilator mit Nachlauf", 1, "psch", 960),
    ("12", "Silikonfugen und Endreinigung", 1, "psch", 340),
], ["Zahlungsbedingungen: 30 % bei Auftragserteilung, Rest nach Fertigstellung, 14 Tage netto.",
    "Gewährleistung: 3 Jahre ab Abnahme.", "Ausführung: ab KW 49/2026, Dauer ca. 12 Arbeitstage."])

quote("Angebot_Wiener_Sanierungsprofi.pdf", "Wiener Sanierungsprofi KG", "Probegasse 3, 1210 Wien", "angebot@sanierungsprofi.example",
      "WS-4471", "04.11.2026", "18.11.2026", [
    ("1", "Abbruch Fliesen und Sanitärgegenstände", 1, "psch", 1150),
    ("2", "Schuttentsorgung", None, None, None, "bauseits"),
    ("3", "Abdichtung Boden/Dusche – nicht im Angebot enthalten, bauseits durch Fremdfirma", None, None, None, "nicht enthalten"),
    ("4", "Estrich ausgleichen", 5, "m²", 52),
    ("5", "Wandfliesen verlegen", 22, "m²", 78),
    ("6", "Bodenfliesen verlegen", 7.5, "m²", 80),
    ("7", "Fliesenmaterial lt. Muster", 30, "m²", 52),
    ("8", "Duschrinne liefern und montieren", 1, "Stk", 690),
    ("9", "Wand-WC inkl. Vorwandelement", 1, "Stk", 950),
    ("10", "Waschtisch inkl. Armatur", 1, "Stk", 690),
    ("11", "Elektroarbeiten – nicht enthalten, Elektriker bauseits", None, None, None, "nicht enthalten"),
    ("12", "Silikonfugen", 1, "psch", 260),
    ("13", "Baustelleneinrichtung und Abdeckarbeiten", 1, "psch", 380),
], ["Zahlungsbedingungen: 50 % Anzahlung bei Auftragserteilung, Rest bei Fertigstellung.",
    "Mehraufwand wird nach Regie mit 58,00 €/h zzgl. Material verrechnet.",
    "Gewährleistung: 2 Jahre. Angebot gültig 14 Tage. Ausführungstermin nach Vereinbarung."])

quote("Angebot_Huber_Haustechnik.pdf", "Huber Haustechnik e.U.", "Beispielplatz 7, 1120 Wien", "huber@haustechnik.example",
      "A-26-093", "05.11.2026", "05.01.2027", [
    ("01", "Demontage Bestand inkl. Badewanne, Fliesen, Sanitär", 1, "psch", 1420),
    ("02", "Entsorgung Bauschutt", 1, "psch", 560),
    ("03", "Flüssigabdichtung Boden und Duschwände", 9, "m²", 68),
    ("04", "Bodenausgleich mit Fließestrich", 7.5, "m²", 56),
    ("05", "Wandfliesen verlegen", 22, "m²", 118),
    ("06", "Bodenfliesen verlegen", 7.5, "m²", 96),
    ("07", "Fliesen Feinsteinzeug 60×60 inkl. Verschnitt", 32, "m²", 58),
    ("08", "Duschrinne 80 cm inkl. Gefälle", 1, "Stk", 740),
    ("09", "Wand-WC mit Vorwandelement", 1, "Stk", 1080),
    ("10", "Waschtisch mit Armatur", 1, "Stk", 780),
    ("11", "Elektroinstallation Bad (Steckdosen, Licht, Lüfter)", 1, "psch", 1150),
    ("12", "Silikonverfugung, Feinreinigung", 1, "psch", 420),
    ("13", "Handtuchheizkörper elektrisch", 1, "Stk", 480, "alt"),
], ["Zahlungsbedingungen: 40 % Anzahlung, 40 % nach Fliesenarbeiten, 20 % nach Abnahme.",
    "Gewährleistung: 2 Jahre.", "Ausführung: Jänner 2027, ca. 15 Arbeitstage."])
