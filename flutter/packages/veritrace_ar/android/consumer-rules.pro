# ARCore appelle son code Java depuis sa bibliothèque native : rien ne doit être renommé ni retiré.
-keep class com.google.ar.** { *; }
-dontwarn com.google.ar.**
-keep class com.veritrace.ar.** { *; }
