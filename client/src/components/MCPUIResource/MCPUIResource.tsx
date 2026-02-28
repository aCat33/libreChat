import React from 'react';
import { UIResourceRenderer } from '@mcp-ui/client';
import { handleUIAction } from '~/utils';
import { useConversationUIResources } from '~/hooks/Messages/useConversationUIResources';
import { useMessagesConversation, useMessagesOperations } from '~/Providers';
import { useLocalize } from '~/hooks';

interface MCPUIResourceProps {
  node: {
    properties: {
      resourceId: string;
    };
  };
}

/**
 * Component that renders an MCP UI resource based on its resource ID.
 * Works in both main app and share view.
 */
export function MCPUIResource(props: MCPUIResourceProps) {
  const { resourceId } = props.node.properties;
  const localize = useLocalize();
  const { ask } = useMessagesOperations();
  const { conversation } = useMessagesConversation();

  const conversationResourceMap = useConversationUIResources(
    conversation?.conversationId ?? undefined,
  );

  const uiResource = conversationResourceMap.get(resourceId ?? '');

  if (!uiResource) {
    return (
      <span className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
        {localize('com_ui_ui_resource_not_found', {
          0: resourceId ?? '',
        })}
      </span>
    );
  }

  try {
    return (
      <div className="mx-1 w-full" style={{ height: '600px', minHeight: '600px' }}>
        <UIResourceRenderer
          resource={uiResource}
          onUIAction={async (result) => handleUIAction(result, ask)}
          htmlProps={{
            autoResizeIframe: { width: true, height: true },
            sandboxPermissions: 'allow-scripts allow-same-origin allow-popups allow-forms',
            style: { height: '600px', width: '100%' },
          }}
        />
      </div>
    );
  } catch (error) {
    console.error('Error rendering UI resource:', error);
    return (
      <span className="inline-flex items-center rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
        {localize('com_ui_ui_resource_error', { 0: uiResource.name || resourceId })}
      </span>
    );
  }
}
