import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  SafeAreaView,
  StatusBar,
  BackHandler,
  Platform,
  View,
  ActivityIndicator,
  Text,
  TouchableOpacity
} from 'react-native';
import { WebView } from 'react-native-webview';

// Deployed Render URL
const CHAT_APP_URL = 'https://mychatapp-8ouk.onrender.com';

export default function App() {
  const webViewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Android hardware back button navigation
  React.useEffect(() => {
    if (Platform.OS === 'android') {
      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true; // prevent exiting app
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }
  }, [canGoBack]);

  const handleReload = () => {
    setHasError(false);
    setIsLoading(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0c0c18" />

      {hasError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorSubtitle}>
            Unable to connect to ChatApp server. Make sure your Vite server is running and accessible at:
          </Text>
          <Text style={styles.urlText}>{CHAT_APP_URL}</Text>

          <TouchableOpacity style={styles.retryButton} onPress={handleReload}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.webviewWrapper}>
          <WebView
            ref={webViewRef}
            source={{ uri: CHAT_APP_URL }}
            style={styles.webview}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            pullToRefreshEnabled={true}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
            }}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />

          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#6366f1" />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c18',
  },
  webviewWrapper: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0c0c18',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0c0c18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0c0c18',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f87171',
    marginBottom: 12,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 8,
  },
  urlText: {
    fontSize: 13,
    color: '#a5b4fc',
    textAlign: 'center',
    marginBottom: 24,
    backgroundColor: '#1e1e2f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
