# FieldQuAd

**FieldQuAd** is a web-based UI developed using **Google Firebase Studio** to assist researchers and field ecologists in estimating **percentage coverage of species** within photoquadrants after fieldwork. The app also supports **coordinate extraction** and exporting of results in multiple formats.

---

## ✨ Key Features

### 🖼️ Image Upload
- Upload images of fieldwork quadrants from your local computer.

### 🛠️ Annotation Tools
- Use various annotation tools to mark and classify objects:
  - **Bounding Box**
  - **Polygon**
  - **Freehand Drawing**
- Assign a class number to each annotation for accurate classification.

### 📍 Coordinate Extraction
- Automatically extract the **coordinates** of all annotations:
  - **Original coordinates** (in pixel values relative to image dimensions)
  - **Normalized coordinates** (scaled between 0 and 1)

### 📊 Percentage Coverage Estimation
- Calculate the **percentage area covered** by each annotated class.
- Useful for ecological assessments, species distribution, and biodiversity monitoring.

### 💾 Export Options
- Download results in multiple formats:
  - **TXT** — For raw coordinate and class data.
  - **JSON** — Structured annotation and coverage data for programmatic use.
  - **XLSX** — Easy-to-read spreadsheet format for reporting and analysis.

---

# My Portfolio

This is a portfolio built with Next.js. You can fork this repo and run the app locally.

## Prerequisites

Before you begin, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://npmjs.com/) (comes with Node.js)

## Steps to Run Locally

1. **Fork the Repo**: Click the "Fork" button at the top right of this page to create a copy of the repository in your GitHub account.

2. **Clone Your Fork**: Clone the forked repository to your local machine.

   ```bash
   git clone /add repo link/
   cd your-forked-repo

