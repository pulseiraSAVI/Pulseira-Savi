#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera el PDF de documentación del proceso SAVI."""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, Table, TableStyle,
    ListFlowable, ListItem, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT

NAVY = colors.HexColor("#0E2A3B")
NAVY2 = colors.HexColor("#123A4F")
INK = colors.HexColor("#16211F")
INKSOFT = colors.HexColor("#5B6663")
AMBER_BG = colors.HexColor("#FBF3D9")
AMBER = colors.HexColor("#8A6D00")
GREEN_BG = colors.HexColor("#E7F3EC")
GREEN = colors.HexColor("#1E6B45")
LINE = colors.HexColor("#E4E1D8")
PAPER = colors.HexColor("#F6F5F1")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("SaviTitle", parent=styles["Title"], textColor=NAVY, fontSize=22, spaceAfter=6))
styles.add(ParagraphStyle("SaviSubtitle", parent=styles["Normal"], textColor=INKSOFT, fontSize=11.5, spaceAfter=18))
styles.add(ParagraphStyle("SaviH1", parent=styles["Heading1"], textColor=NAVY, fontSize=16, spaceBefore=18, spaceAfter=8))
styles.add(ParagraphStyle("SaviH2", parent=styles["Heading2"], textColor=NAVY2, fontSize=13, spaceBefore=12, spaceAfter=6))
styles.add(ParagraphStyle("SaviBody", parent=styles["Normal"], textColor=INK, fontSize=10.3, leading=15, spaceAfter=8, alignment=TA_LEFT))
styles.add(ParagraphStyle("SaviBodySmall", parent=styles["Normal"], textColor=INKSOFT, fontSize=9.3, leading=13))
styles.add(ParagraphStyle("SaviCaption", parent=styles["Normal"], textColor=INKSOFT, fontSize=9, alignment=TA_CENTER, spaceBefore=6, spaceAfter=4))
styles.add(ParagraphStyle("SaviTableHead", parent=styles["Normal"], textColor=colors.white, fontSize=9.5, fontName="Helvetica-Bold"))
styles.add(ParagraphStyle("SaviTableCell", parent=styles["Normal"], textColor=INK, fontSize=9, leading=12))
styles.add(ParagraphStyle("SaviTableCellCrit", parent=styles["Normal"], textColor=AMBER, fontSize=9, leading=12))

story = []

# ---------- Portada ----------
story.append(Spacer(1, 40))
story.append(Paragraph("SAVI", styles["SaviTitle"]))
story.append(Paragraph("Sistema de Acesso Virtual a Informação Clínica", styles["SaviSubtitle"]))
story.append(Paragraph("Documentación del proceso de construcción y despliegue", styles["SaviH1"]))
story.append(Paragraph(
    "Registro completo de lo realizado desde la creación del proyecto hasta la demo publicada: "
    "herramientas utilizadas, puntos críticos encontrados en cada estación del proceso, y sugerencias "
    "de mejora para las próximas iteraciones.",
    styles["SaviBody"]))
story.append(Spacer(1, 10))
story.append(HRFlowable(width="100%", thickness=1, color=LINE))
story.append(Spacer(1, 10))
story.append(Paragraph("Fecha del informe: 9 de septiembre de 2026", styles["SaviBodySmall"]))
story.append(Paragraph("Repositorio: pulseiraSAVI/Pulseira-Savi — demo publicada en "
                        "https://pulseirasavi.github.io/Pulseira-Savi/", styles["SaviBodySmall"]))
story.append(PageBreak())

# ---------- Resumen ejecutivo ----------
story.append(Paragraph("1. Resumen ejecutivo", styles["SaviH1"]))
story.append(Paragraph(
    "Se construyó y publicó una <b>demo interactiva y funcional</b> de la primera iteración de SAVI: los tres "
    "flujos de la Fase 1 (profesional clínico, familia, equipa administradora), con el ecrã de Nível 1 fiel al "
    "mockup de referencia, 2FA simulado, timeout de sesión real, y empaquetada como PWA instalable. Está "
    "publicada en GitHub Pages y es navegable por cualquier persona del equipo.",
    styles["SaviBody"]))
story.append(Paragraph(
    "<b>No es</b> una aplicación en producción: no hay backend real (Firestore, Cloudflare Worker, Firebase "
    "Auth), los datos viven en localStorage del navegador, y el propio CLAUDE.md del proyecto exige EIPD/DPIA "
    "formal, DPAs con subprocesadores y clarificar el responsable del tratamiento antes de incluir cualquier "
    "paciente piloto real — pendientes que no dependen de código.",
    styles["SaviBody"]))
story.append(Paragraph(
    "El proceso de construcción en sí avanzó sin sobresaltos; el <b>despliegue en GitHub</b> fue donde se "
    "concentraron casi todos los puntos de fricción — detallados en las secciones 2 y 3, junto con sugerencias "
    "concretas para evitarlos en la próxima iteración.",
    styles["SaviBody"]))

# ---------- Cronología ----------
story.append(Paragraph("2. Cronología del proceso", styles["SaviH1"]))

fases = [
    ("Fase A — Especificación", [
        "Lectura de CLAUDE.md y los tres documentos fuente (Resumo do Projeto, Arquitetura Técnica, "
        "Design App Papel) más el mockup HTML de referencia del ecrã de Nível 1.",
        "Resultado: modelo de datos (schema SQL → colecciones Firestore), roles y permisos, flujo de "
        "scan/break-glass, y reglas no negociables confirmadas antes de escribir ninguna línea de código.",
    ]),
    ("Fase B — Construcción de la demo", [
        "Construcción del frontend (vanilla JS, sin frameworks) y del scaffolding de backend "
        "(Firestore Security Rules, esqueleto de Cloudflare Worker) mediante un subagente — que se "
        "interrumpió a mitad de camino por un error de conexión y tuvo que reanudarse con un segundo "
        "subagente al que se le dio contexto explícito de lo ya construido.",
        "Empaquetado como PWA: manifest, service worker con caché versionado, e iconos generados con "
        "ImageMagick a partir de un SVG propio.",
        "Ajustes de diseño responsive en varias vueltas sucesivas, a medida que se acotaba qué se quería "
        "ver en escritorio frente a móvil (de una moldura de teléfono decorativa, a un tope de ancho tipo "
        "portátil de 15\", a pantalla completa sin tope en ningún tamaño).",
    ]),
    ("Fase C — Publicación en GitHub Pages", [
        "Conexión a la carpeta de proyecto del usuario y primer intento de preparar un repositorio git "
        "local — bloqueado parcialmente porque esa carpeta compartida no permite borrar ni renombrar "
        "archivos ya creados por otros procesos.",
        "El usuario ofreció un token de acceso personal de GitHub para que se usara directamente — "
        "rechazado por política (los tokens/API keys nunca se manejan, sin excepción), lo que generó "
        "confusión inicial al compararlo con la experiencia en otro proyecto con Claude Code.",
        "Subida del proyecto por la interfaz web de GitHub (arrastrar y soltar), lo que omitió en silencio "
        "los archivos y carpetas ocultos (.github, .nojekyll) — el sitio publicado terminó mostrando el "
        "README renderizado por Jekyll en vez de la app real, sin ningún mensaje de error.",
        "Intento de resolverlo por terminal con git — bloqueado por una credencial de otra cuenta de "
        "GitHub cacheada en el llavero de macOS, que dio un error 403 de permisos.",
        "Se decidió cambiar de estrategia a \"Deploy from a branch\", lo que requirió renombrar la carpeta "
        "de la app de frontend/ a docs/ (única carpeta que ese modo admite además de la raíz) y volver a "
        "subir los archivos, esta vez incluyendo los ocultos mediante \"Add file → Create new file\" con "
        "la ruta escrita a mano.",
    ]),
    ("Fase D — Validación", [
        "Verificación visual final: la URL pública carga el login real de la app (no el README), y el "
        "navegador ofrece instalarla como PWA — confirmando que el despliegue quedó correcto.",
    ]),
]

for titulo, puntos in fases:
    story.append(Paragraph(titulo, styles["SaviH2"]))
    story.append(ListFlowable(
        [ListItem(Paragraph(p, styles["SaviBody"]), bulletColor=NAVY2) for p in puntos],
        bulletType="bullet", start="•", leftIndent=14,
    ))

story.append(PageBreak())

# ---------- Tabla de estaciones ----------
story.append(Paragraph("3. Herramientas y puntos críticos por estación", styles["SaviH1"]))
story.append(Paragraph(
    "Cada fila corresponde a un nodo del flujograma de la sección 4. Las estaciones marcadas como punto "
    "crítico tuvieron fricción real durante el proceso — no son riesgos teóricos.",
    styles["SaviBody"]))

def cell(text, style=styles["SaviTableCell"]):
    return Paragraph(text, style)

rows = [
    [cell("#", styles["SaviTableHead"]), cell("Estación", styles["SaviTableHead"]),
     cell("Herramientas", styles["SaviTableHead"]), cell("Punto crítico", styles["SaviTableHead"]),
     cell("Sugerencia", styles["SaviTableHead"])],
    ["1", cell("Ingesta de requisitos"), cell("Read, python-docx (bash)"),
     cell("— (sin fricción)"), cell("Mantener CLAUDE.md como fuente única de verdad")],
    ["2", cell("Construcción frontend/backend"), cell("Agent (subagente), Write/Edit, node --check"),
     cell("Subagente cortado a mitad, hubo que reanudar", styles["SaviTableCellCrit"]),
     cell("Dividir builds grandes en tareas con checkpoints intermedios")],
    ["3", cell("Empaquetado PWA"), cell("ImageMagick, Write"),
     cell("Bump manual de SW_VERSION, fácil de olvidar", styles["SaviTableCellCrit"]),
     cell("Automatizar el versionado del service worker")],
    ["4", cell("Diseño responsive"), cell("Edit sobre CSS, revisión manual"),
     cell("3 vueltas completas por alcance no acotado; sin navegador headless para verificar", styles["SaviTableCellCrit"]),
     cell("Definir breakpoints/dispositivos objetivo antes de la primera pasada")],
    ["5", cell("Preparar repo git local"), cell("bash (git init/commit) en carpeta montada"),
     cell("El mount no permite borrar/renombrar archivos existentes", styles["SaviTableCellCrit"]),
     cell("Trabajar en una carpeta temporal y copiar el resultado final")],
    ["6", cell("Acceso a GitHub vía token"), cell("— (bloqueado por política)"),
     cell("Confusión por expectativa distinta de otro proyecto/herramienta", styles["SaviTableCellCrit"]),
     cell("Aclarar de entrada qué vía de acceso a GitHub es viable")],
    ["7", cell("Subida por interfaz web"), cell("Finder, github.com/upload"),
     cell("Archivos ocultos (.github, .nojekyll) omitidos sin aviso", styles["SaviTableCellCrit"]),
     cell("Usar \"Create new file\" con ruta escrita a mano para ocultos")],
    ["8", cell("Configurar Pages (Actions)"), cell("Settings → Pages"),
     cell("Sin el workflow subido, Jekyll publicó el README por error", styles["SaviTableCellCrit"]),
     cell("Verificar visualmente la URL tras cada cambio de Pages")],
    ["9", cell("git push por terminal"), cell("Terminal, git, llavero macOS"),
     cell("403 por credencial de otra cuenta cacheada", styles["SaviTableCellCrit"]),
     cell("Correr \"gh auth status\" antes de cualquier push")],
    ["10", cell("Cambio a Deploy from a branch"), cell("bash (mv, touch), Edit, GitHub web"),
     cell("Restricción de carpeta (/ o /docs) no conocida de antemano", styles["SaviTableCellCrit"]),
     cell("Decidir el método de deploy antes de fijar la estructura de carpetas")],
    ["11", cell("Verificación final"), cell("Navegador, checklist de flujos"),
     cell("— (resuelto)"), cell("Repetir esta verificación tras cualquier cambio futuro")],
]

col_widths = [1.1*cm, 4.0*cm, 4.2*cm, 5.6*cm, 5.6*cm]
tbl = Table(rows, colWidths=col_widths, repeatRows=1)
tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("BACKGROUND", (0, 1), (-1, -1), colors.white),
    ("GRID", (0, 0), (-1, -1), 0.5, LINE),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
]))
story.append(tbl)
story.append(PageBreak())

# ---------- Flujograma ----------
story.append(Paragraph("4. Flujograma del proceso", styles["SaviH1"]))
story.append(Paragraph(
    "Verde = paso sin fricción. Ámbar = punto crítico encontrado durante el proceso real (no hipotético).",
    styles["SaviBody"]))
story.append(Image("flujograma_top.png", width=16.5*cm, height=15.68*cm))
story.append(Paragraph("Fases A y B, y estaciones 1 a 5 de la Fase C", styles["SaviCaption"]))
story.append(PageBreak())
story.append(Image("flujograma_bottom.png", width=16.5*cm, height=15.68*cm))
story.append(Paragraph("Estaciones 6 a 11 (Fase C y Fase D)", styles["SaviCaption"]))
story.append(PageBreak())

# ---------- Sugerencias generales ----------
story.append(Paragraph("5. Sugerencias generales para la próxima iteración", styles["SaviH1"]))
sugerencias = [
    "<b>Adoptar git/terminal desde el día uno</b> en vez de la subida web, para un proyecto que seguirá "
    "evolyendo — evita las sorpresas de archivos ocultos filtrados y de builds automáticos de Jekyll.",
    "<b>Confirmar la cuenta activa de git/GitHub</b> (<font face=\"Courier\">gh auth status</font>) antes de "
    "cualquier push, sobre todo si se trabaja con varias cuentas u organizaciones.",
    "<b>Decidir el método de deploy de GitHub Pages</b> (rama vs. Actions) antes de nombrar la estructura de "
    "carpetas del proyecto, ya que \"Deploy from a branch\" impone la restricción de carpeta / o /docs.",
    "<b>Verificación visual como paso estándar</b> después de cualquier cambio de configuración de Pages, no "
    "solo cuando algo parece ir mal.",
    "<b>Adelantar la pista legal/organizativa en paralelo</b> a la técnica: EIPD/DPIA formal, DPAs con "
    "Firebase/Cloudflare/Resend, y decidir el responsable del tratamiento — son bloqueantes reales para "
    "pacientes piloto y no dependen de ningún avance de código.",
    "<b>Cerrar las preguntas abiertas del CLAUDE.md</b> (destaque visual de alergias/grupo sanguíneo, modelo "
    "de verificación clínica única vs. doble, seguridad del acceso por búsqueda, etc.) antes de construir "
    "sobre supuestos no confirmados.",
    "<b>Probar el flujo completo con un paciente ficticio</b> contra la infraestructura real (Firebase/"
    "Cloudflare reales) antes de plantear cualquier paciente piloto verdadero.",
]
story.append(ListFlowable(
    [ListItem(Paragraph(s, styles["SaviBody"]), bulletColor=NAVY2) for s in sugerencias],
    bulletType="bullet", start="•", leftIndent=14,
))

doc = SimpleDocTemplate(
    "SAVI_Documentacion_Proceso.pdf", pagesize=letter,
    topMargin=1.8*cm, bottomMargin=1.8*cm, leftMargin=2*cm, rightMargin=2*cm,
    title="SAVI — Documentación del proceso", author="Claude (Cowork)",
)
doc.build(story)
print("PDF generado.")
