
══╡ EXCEPTION CAUGHT BY RENDERING LIBRARY ╞═════════════════════════════════════════════════════════
The following assertion was thrown during layout:
A RenderFlex overflowed by 25 pixels on the bottom.

The relevant error-causing widget was:
  Column
  Column:file:///C:/Users/ASUS/Documents/SEM%206/FYP%202/code/MySmartStudy/frontend-mobile/lib/screens/subjects_screen.dart:975:18

To inspect this widget in Flutter DevTools, visit:
http://127.0.0.1:49684/qclUc54241o=/devtools//#/inspector?uri=http%3A%2F%2F127.0.0.1%3A49684%2FqclUc54241o%3D%2F&inspectorRef=inspector-0

The overflowing RenderFlex has an orientation of Axis.vertical.
The edge of the RenderFlex that is overflowing has been marked in the rendering with a yellow and
black striped pattern. This is usually caused by the contents being too big for the RenderFlex.
Consider applying a flex factor (e.g. using an Expanded widget) to force the children of the
RenderFlex to fit within the available space instead of being sized to their natural size.
This is considered an error condition because it indicates that there is content that cannot be
seen. If the content is legitimately bigger than the available space, consider clipping it with a
ClipRect widget before putting it in the flex, or using a scrollable container rather than a Flex,
like a ListView.
The specific RenderFlex in question is: RenderFlex#afbd7 OVERFLOWING:
  needs compositing
  creator: Column ← Padding ← ColoredBox ← Container ← BackdropFilter ← ClipRect ← SizedBox ←
    _SliverPinnedPersistentHeader ← SliverPersistentHeader ← Viewport ←
    IgnorePointer-[GlobalKey#f98b5] ← Semantics ← ⋯
  parentData: offset=Offset(16.0, 8.0) (can use size)
  constraints: BoxConstraints(w=416.0, h=63.5)
  size: Size(416.0, 63.5)
  direction: vertical
  mainAxisAlignment: start
  mainAxisSize: min
  crossAxisAlignment: center
  verticalDirection: down
  spacing: 0.0
◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤
════════════════════════════════════════════════════════════════════════════════════════════════════