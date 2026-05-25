import org.jetbrains.intellij.platform.gradle.TestFrameworkType

plugins {
    kotlin("jvm") version "1.9.24"
    id("org.jetbrains.intellij.platform") version "2.0.1"
}

group = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

kotlin {
    jvmToolchain(17)
}

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        create(
            providers.gradleProperty("platformType").get(),
            providers.gradleProperty("platformVersion").get(),
        )
        // VCS bundled plugin gives us Git repo detection.
        bundledPlugin("Git4Idea")
        // Optional: reuse the user's GitHub login from the bundled GitHub plugin.
        bundledPlugin("org.jetbrains.plugins.github")
        instrumentationTools()
        testFramework(TestFrameworkType.Platform)
    }
    testImplementation(kotlin("test"))
}

intellijPlatform {
    pluginConfiguration {
        name = providers.gradleProperty("pluginName")
        version = providers.gradleProperty("pluginVersion")
        ideaVersion {
            sinceBuild = providers.gradleProperty("pluginSinceBuild")
            untilBuild = providers.gradleProperty("pluginUntilBuild")
        }
    }
    buildSearchableOptions = false

    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
}

tasks {
    wrapper {
        gradleVersion = "8.7"
    }
    test {
        useJUnitPlatform()
    }
}
