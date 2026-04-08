import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import AdminLoginScreen from "../screens/AdminLoginScreen";
import AdminPortalScreen from "../screens/AdminPortalScreen";
import AppNavigator from "./AppNavigator";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{ headerShown: false, animation: "fade" }}
    >
      <Stack.Screen name="MainTabs" component={AppNavigator} />
      <Stack.Screen
        name="AdminLogin"
        component={AdminLoginScreen}
        options={{ animation: "slide_from_bottom", presentation: "modal" }}
      />
      <Stack.Screen
        name="AdminPortal"
        component={AdminPortalScreen}
        options={{ animation: "slide_from_right" }}
      />
    </Stack.Navigator>
  );
}
