plugins {
    id("com.android.application")
}

android {
    namespace = "app.bulles"
    compileSdk {
        version = release(37)
    }
    defaultConfig {
        applicationId = "app.bulles"
        minSdk = 26
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("com.google.android.gms:play-services-auth:21.1.1")
}

// Copie l'appli web (index.html, style.css, app.js) dans les assets avant chaque compilation
val copierWeb by tasks.registering(Copy::class) {
    from(rootDir.parentFile) { include("index.html", "style.css", "app.js", "logo.svg", "vendor/**") }
    into(layout.projectDirectory.dir("src/main/assets"))
}
tasks.named("preBuild") { dependsOn(copierWeb) }
