plugins {
    id("com.android.application") version "9.4.1" apply false
}

// Compilation hors du dossier du projet : OneDrive verrouille les fichiers pendant la synchro
allprojects {
    layout.buildDirectory.set(file(System.getProperty("java.io.tmpdir") + "/pagivore-build/" + project.name))
}
