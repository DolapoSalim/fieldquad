# **App Name**: FieldQuAD

## Core Features:

- Image Upload: Allow users to upload images of fieldwork quadrants from their local computer.
- Annotation Tools: Offer a selection of annotation tools (e.g., bounding box, polygon, freehand) for users to mark specific objects or areas of interest within the image. For the classes annotated, we cannot assign another number to a class that has an already existing annotation, so we may have the option of selecting from already existing annotation class if they have previously been annotated within the image.
- Coordinate Extraction: Extract the coordinates of the annotations relative to the original image dimensions. The annotation file should specify with number the classes or object that have been annotated and each of their coordinates within. Then the coordinate may be exported in the original coordinate and a normalized on of range 1-0
- Save coordinates: Enable users to download the extracted coordinates as a text file (.txt) in either forms, normalized or original coordinate

## Style Guidelines:

- Use a muted green (#4CAF50) to reflect the biological context.
- Light grey (#F0F0F0) for the background to provide contrast.
- A teal (#008080) for interactive elements and highlights.
- Clean and intuitive layout with clear visual hierarchy.
- Use clear, scientific icons for annotation tools and other functions.